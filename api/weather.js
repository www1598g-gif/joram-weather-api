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
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const hourlyData = [];
    
    $('.time-series__item').each((i, el) => {
      if (i < 8) {
        const time = $(el).find('.time').text().trim();
        const temp = $(el).find('.temp').text().trim();
        const rain = $(el).find('.precipitation').text().trim() || "0%"; 
        const weather = $(el).find('.weather').text().trim() || $(el).find('img').attr('alt') || '不明';

        if (time) {
          hourlyData.push({
            time: time.match(/\d+/) ? `${time.match(/\d+/)[0]}:00` : time, 
            temp: temp.replace('℃', '') + '°',
            rain: rain.includes('%') ? rain : `${rain}%`,
            weather
          });
        }
      }
    });

    const currentTemp = $('.obs-current__temp .num').text().trim() || hourlyData[0]?.temp || 'N/A';
    const currentWeather = $('.obs-current__weather').text().trim() || hourlyData[0]?.weather || 'N/A';

    return res.status(200).json({
      success: true,
      location: target,
      current: { temp: currentTemp, weather: currentWeather },
      hourly: hourlyData
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
