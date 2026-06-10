const COORDS = {
  huistenbosch: { lat: 33.086749, lon: 129.787998 },
  takashima:    { lat: 32.657423, lon: 129.753335 },
  nagasaki_city:{ lat: 32.748801, lon: 129.872901 }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const { target } = req.query;
  if (!target || !COORDS[target]) {
    return res.status(400).json({ error: '請傳入正確的 target 參數' });
  }

  const { lat, lon } = COORDS[target];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Accept-Language': 'ja,zh-TW;q=0.9',
    'Referer': `https://weathernews.jp/onebox/${lat}/${lon}/`
  };

  try {
    const [pinpointRes, mrfRes] = await Promise.all([
      fetch(`https://weathernews.jp/pinpoint/?wash_type=c&lat=${lat}&lon=${lon}`, { headers }),
      fetch(`https://weathernews.jp/mrf?lat=${lat}&lon=${lon}&tm=29684600`, { headers })
    ]);

    const pinpointData = await pinpointRes.json();
    const mrfData = await mrfRes.json();

    const nowInJp = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const nowTs = Math.floor(nowInJp.getTime() / 1000);

    // 過濾出現在之後的 8 筆
    const futureHourly = (pinpointData?.result?.hourly || [])
      .filter(h => h.time >= nowTs)
      .slice(0, 8);

    if (futureHourly.length === 0) {
      return res.status(200).json({ success: false, error: '無法取得未來預報資料' });
    }

    // mrf 每日降雨機率對應
    const mrfList = mrfData?.fcst?.mrf || [];
    const getRainForTs = (ts) => {
      for (const day of mrfList) {
        const dayTs = day.wxdata?.tm;
        if (dayTs && ts >= dayTs && ts < dayTs + 86400) {
          return day.wxdata.POP;
        }
      }
      return null;
    };

    const hourly = futureHourly.map(h => {
      const jpTime = new Date(h.time * 1000).toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
      const timeStr = new Date(jpTime).toTimeString().slice(0, 5);
      const rain = getRainForTs(h.time);
      return {
        time: timeStr,
        temp: `${h.temp}°`,
        rain: rain !== null ? `${rain}%` : '—',
        rhum: `${h.rhum}%`,
        wind: `${h.wndspd}m/s`,
        weather: rain >= 40 ? '局部陣雨' : '多雲時晴'
      };
    });

    return res.status(200).json({
      success: true,
      location: target,
      current: { temp: hourly[0]?.temp, weather: hourly[0]?.weather },
      hourly
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}