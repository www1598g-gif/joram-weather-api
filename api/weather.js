const cheerio = require('cheerio');

const URL_MAP = {
  huistenbosch: "https://weathernews.jp/onebox/33.086749/129.787998/",
  takashima: "https://weathernews.jp/onebox/32.657423/129.753335/",
  nagasaki_city: "https://weathernews.jp/onebox/32.748801/129.872901/"
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const { target } = req.query;
  if (!target || !URL_MAP[target]) {
    return res.status(400).json({ error: '請傳入正確的 target 參數' });
  }

  try {
    const response = await fetch(URL_MAP[target], {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'ja,zh-TW;q=0.9'
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // 臨時 debug — 看氣溫附近的 HTML
const rawHtml = html.substring(0, 8000);
return res.status(200).json({ debug_html: rawHtml });

    let times = [];
    let rains = [];
    let temps = [];

    // 抓時間
    $('[class*="time"], [class*="hour"], td, th, span, div').each((i, el) => {
      const txt = $(el).text().trim().replace(/\s+/g, '');
      if (/^(\d{1,2})(時|時00分|:00)$/.test(txt)) {
        const hour = txt.match(/\d+/)[0];
        const timeStr = `${hour.padStart(2, '0')}:00`;
        if (!times.includes(timeStr) && times.length < 8) {
          times.push(timeStr);
        }
      }
    });

    // 抓氣溫
    $('[class*="temp"], [class*="temperature"], td, span, div').each((i, el) => {
      const txt = $(el).text().trim().replace(/\s+/g, '');
      if (/^-?\d{1,2}°$/.test(txt)) {
        if (temps.length < 8) temps.push(txt);
      }
    });

    // 抓降雨機率
    $('[class*="rain"], [class*="precip"], td, span, div').each((i, el) => {
      const txt = $(el).text().trim().replace(/\s+/g, '');
      if (/^\d{1,3}%$/.test(txt)) {
        if (rains.length < 8) rains.push(txt);
      }
    });

    // 如果任何一個沒抓到足夠資料，回傳失敗
    if (times.length === 0 || temps.length === 0 || rains.length === 0) {
      return res.status(200).json({
        success: false,
        error: '爬蟲無法解析頁面結構，可能網站改版',
        debug: { times, temps, rains }
      });
    }

    const count = Math.min(times.length, temps.length, rains.length, 8);
    const hourly = [];
    for (let i = 0; i < count; i++) {
      hourly.push({
        time: times[i],
        temp: temps[i],
        rain: rains[i],
        weather: parseInt(rains[i]) >= 40 ? '局部陣雨' : '多雲時晴'
      });
    }

    return res.status(200).json({
      success: true,
      location: target,
      current: {
        temp: temps[0],
        weather: parseInt(rains[0]) >= 40 ? '局部陣雨' : '多雲時晴'
      },
      hourly
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}