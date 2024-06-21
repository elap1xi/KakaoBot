const { onRequest } = require("firebase-functions/v2/https");

require("dotenv").config();
const axios = require('axios');
const cheerio = require("cheerio");
const express = require('express');
const app = express();
const fs = require('fs');
const location = require('./src/location');

const apiToken_neis = process.env.TOKENNEIS;
const apiToken_data = process.env.TOKENDATA;

async function get_shop(query) {
    return await axios.get(`https://openapi.naver.com/v1/search/shop.json?query=`+encodeURI(query)+`&display=100&start=1&sort=sim&exclue=used:rental`, {
        headers: {
            'X-Naver-Client-Id' : process.env.XNAVERID,
            'X-Naver-Client-Secret' : process.env.XNAVERSECRET
        }
    }).then(res => res.data);
}

app.post('/shopping', async(req, res) => {
    let goods = req.body['action']['params']['goods'];
    console.log(process.env.XNAVERID);
    console.log(goods);
    let data = await get_shop(goods);

    if(data.items.length==0){
        res.json({
            'reply':"Nah"
        });
    }
    var filtered_item = [];
    for(let i=0; i<100; i++){
        try{
            if(data.items[i].mallName=="네이버"){
                if((data.items[i].title).indexOf("대여")==-1){
                    if((data.items[i].brand)!==''){
                        filtered_item.push(data.items[i]);
                    }
                }
            }
        } catch {
            filtered_item.push(data.items[0]);
        }
    }

    async function frmt(json) {
        let title = (json.title).replace(/<b>/gi,'').replace(/<\/b>/gi,'');
        let url = json.link;
        let url_img = json.image;
        let lprice = json.lprice;
        let hprice = json.hprice;
        let mall;
        try{ mall = json.mallName; } catch { mall = '-'; }
        lprice = lprice == '' ? "-" : lprice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        hprice = hprice == '' ? "-" : hprice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        console.log(title, url, lprice);
        res.json(
            {
                "version": "2.0",
                "template": {
                  "outputs": [
                    {
                      "basicCard": {
                        "title": title,
                        "description": `${json.category1} > ${json.category2} > ${json.category3}\n| 상품 최저가 : ${lprice}원 | 판매처:${mall}`,
                        "thumbnail": {
                          "imageUrl": url_img
                        },
                        "buttons": [
                          {
                            "action": "webLink",
                            "label": "상품 바로가기",
                            "webLinkUrl": url
                          }
                        ]
                      }
                    }
                  ]
                }
              }
        );
    }

    if(filtered_item.length==0){
        frmt(data.items[0]);
    } else {
        frmt(filtered_item[0]);
    }
});

app.post('/chart', async (req, res) => {
    var chart__ = fs.readFileSync("data/cache/melon_chart.txt", "utf8");
    fs.writeFileSync('data/cache/melon_chart.txt', '\n', 'utf8');
    try{
        const r = await axios.get('https://smu.melon.com/chart/index.htm');
        const $ = cheerio.load(r.data);
        $("tbody tr").each((i, e) => {
            if(i+1>=11) return;
            let data = `${i+1}위 : ${$(e).find(".ellipsis.rank01").text().trim()} - ${$(e).find(".ellipsis.rank02 .checkEllipsis").text().trim()}`;
            fs.appendFileSync('data/cache/melon_chart.txt', data+'\n', 'utf8');
        });
        let chart_check = fs.readFileSync("data/cache/melon_chart.txt", "utf8");
        if(chart_check=="\n"){
            fs.writeFileSync('data/cache/melon_chart.txt', chart__, 'utf8');
        }
        res.json({
            'reply': fs.readFileSync("data/cache/melon_chart.txt", "utf8")
        })
    } catch(error) {
        let chart_check = fs.readFileSync("data/cache/melon_chart.txt", "utf8");
        if(chart_check=="\n"){
            fs.writeFileSync('data/cache/melon_chart.txt', chart__, 'utf8');
        }
        res.json({
            'reply': '에러가 발생했어요'
        });
    }
});

app.post('/score', (req, res) => {
    try{
        let person = Number(req.body['action']['params']['person']);
        res.json({
            'reply': `1등급 : 1등 - ${Math.round(person*0.04)}등\n 2등급 : ${Math.round(person*0.04)+1}등 - ${Math.round(person*0.11)}등\n3등급 : ${Math.round(person*0.11)+1}등 - ${Math.round(person*0.23)}등\n4등급 : ${Math.round(person*0.23)+1}등 - ${Math.round(person*0.4)}등\n5등급 : ${Math.round(person*0.4)+1}등 - ${Math.round(person*0.6)}등\n6등급 : ${Math.round(person*0.6)+1}등 - ${Math.round(person*0.77)}등\n7등급 : ${Math.round(person*0.77)+1}등 - ${Math.round(person*0.89)}등\n8등급 : ${Math.round(person*0.89)+1}등 - ${Math.round(person*0.96)}등\n9등급 : ${Math.round(person*0.96)+1}등 - ${person}등`
        });
        return; 
    } catch {
        res.json({
            'reply': '학생수를 정확하게 입력해 주세요'
        });
        return;
    }
    
});

async function weather(url) {
    async function parse(url) {
        let json = axios.get(url)
            .then(res => res.data)
            .catch(error => { console.log(error); })
        return json;
    }
    let json = await parse(url);
    var data;
    try { data = json.response.body.items.item; } 
    catch { return "ERR"; }
    return data;
}

app.post('/weather', async (req, res) => {
    let content = req.body['action']['params']['location'];
    var location_value = await location.get_info(content);
    if (location_value == "CANNOT_FIND") {
        res.json({
            'reply':'해당 지역을 찾을 수 없습니다\n지명을 정확하게 알려주세요',
        });
        return;
    }
    const loc_arr = location_value.split(" ");

    var DTE = new Date();
    var Year = String(DTE.getFullYear());
    var Month = String(DTE.getMonth() + 1);
    var Day = (DTE.getDate());
    var Hour = DTE.getHours();
    var Min = DTE.getMinutes();

    let day = Hour == 0 ? String(Day - 1) : String(Day);
    let hour = Hour == 0 ? "23" : String(Hour - 1);

    var min = Min > 45 ? "00" : "30";
    var month = Month.length == 1 ? `0${Month}` : Month;
    day = day.length == 1 ? `0${day}` : day;
    hour = hour.length == 1 ? `0${hour}` : hour;

    var frst_base_date = `${Year}${month}${day}`;
    var frst_base_time = `${hour}${min}`;
    var url = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst?serviceKey=${apiToken_data}&dataType=JSON&numOfRows=100&pageNo=1&base_date=${frst_base_date}&base_time=${frst_base_time}&nx=${loc_arr[1]}&ny=${loc_arr[2]}`;
    try {
        var data = await weather(url);
        if ((String(Hour + 1)).length == 1) { Hour_fcst = `0${Hour + 1}`; }
        else { var Hour_fcst = String(Hour + 1) }

        if (Hour_fcst == '24') { Hour_fcst = '00'; }
        var index_fcst = [];
        let T1H, RN1, SKY, UUU, VVV, REH, PTY, LGT, VEC, WSD;
        for (let para in data) {
            if (data[para].fcstTime == `${Hour_fcst}00`) {
                index_fcst.push(para);
                switch (data[para].category) {
                    case "T1H": T1H = data[para].fcstValue; break;
                    case "RN1": RN1 = data[para].fcstValue; break;
                    case "SKY": SKY = data[para].fcstValue; break;
                    // case "UUU": UUU = data[para].fcstValue; break;
                    // case "VVV": VVV = data[para].fcstValue; break;
                    case "REH": REH = data[para].fcstValue; break;
                    case "PTY": PTY = data[para].fcstValue; break;
                    // case "LGT": LGT = data[para].fcstValue; break;
                    // case "VEC": VEC = data[para].fcstValue; break;
                    // case "WSD": WSD = data[para].fcstValue; break;
                }
            }
        }


        let Rain;
        if (RN1 == '강수없음') { Rain = '강수없음'; }
        else { Rain = `${RN1}`; }

        let Sky;
        if (SKY == 1) { Sky = '맑음'; }
        else if (SKY == 3) { Sky = '구름 많음'; }
        else if (SKY == 4) { Sky = '흐림' }

        let Pty;
        if (PTY == 0) { Pty = ''; }
        else if (PTY == 1) { Pty = '(비)'; }
        else if (PTY == 2) { Pty = '(비/눈)'; }
        else if (PTY == 3) { Pty = '(눈)'; }
        else if (PTY == 5) { Pty = '(빗방울)'; }
        else if (PTY == 6) { Pty = '(빗방울만 날림)'; }
        else if (PTY == 7) { Pty = '(눈날림)'; }

        let Humidity = `${REH}%`;
        // let Ligtening = `${LGT}kA`;
        // let Wind_Direction = `${VEC}`;
        // let Wind_Speed = `${WSD}m/s`;

        let loc_3;
        if(loc_arr[5]){ loc_3 = `(${loc_arr[5]})`; }
        else { loc_3 = ''; }
        let location = `(${loc_arr[3]} ${loc_arr[4]} ${loc_3})`;

        // console.log(T1H, Sky, Rain, Pty, Ligtening, Wind_Speed, Wind_Direction, Humidity, Hour_fcst);
        res.json({
            'reply' : `${location}\n기온은 ${T1H}℃ (${Sky}) 강수량은 ${Rain}${Pty}, 습도는 ${Humidity}입니다`,
        });
        return;

    } catch {
        res.json({
            'reply':"에러가 발생했어요.\n잠시후 다시 시도해 주세요."
        });
        return;
    }
});

async function get(url) {
    return await axios.get(url).then(res => res.data);
}

app.post('/menu', async (req, res) => {
    var DTE = new Date();
    DTE.setHours(DTE.getHours() + 9);
    var Year = String(DTE.getFullYear());
    var Month = String(DTE.getMonth() + 1); Month = Month.length == 1 ? `0${Month}` : Month;
    var Day = (DTE.getDate()); Day = Day.length == 1 ? `0${Day}` : Day;

    let MLSV_YMD = `${Year}${Month}${Day}`;
    let MLSV_YMD_f = `${Year}/${Month}/${Day}`;

    var PLA = new Date(`${Year}-${Month}-${Day}`);
    if (PLA.getDay() == 0 || PLA.getDay() == 6) {
        res.json({
            'menu': "주말에는 급식이 없어요!",
            'menu_cal': "",
            'date': MLSV_YMD_f
        });
        return;

    } else {
        let url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=100&KEY=${apiToken_neis}&ATPT_OFCDC_SC_CODE=H10&SD_SCHUL_CODE=7480093&MLSV_YMD=${MLSV_YMD}`;

        try {
            var json = await get(url);
            let menu_row, menu_cal;
            if ((json.mealServiceDietInfo[1].row).length > 1) {
                for (let i = 0; i < (json.mealServiceDietInfo[1].row).length; i++) {
                    if (json.mealServiceDietInfo[1].row[i].MMEAL_SC_NM == '중식') {
                        menu_row = json.mealServiceDietInfo[1].row[i].DDISH_NM;
                        menu_cal = json.mealServiceDietInfo[1].row[i].CAL_INFO;
                    }
                }
            } else {
                menu_row = json.mealServiceDietInfo[1].row[0].DDISH_NM;
                menu_cal = json.mealServiceDietInfo[1].row[0].CAL_INFO;
            }

            menu_row = String(menu_row)
            .replace(/[<br/>]/g, '-')
            .replace(/-----/gi, '\n')
            .replace(/[(.*[0-9)]/gi, '')
            .replace(/자율/gi, ' (자율)');

            res.json({
                'menu': menu_row,
                'menu_cal': menu_cal,
                'date': MLSV_YMD_f
            });
            return;

        } catch (error) {
            res.json({
                'menu': "에러가 발생했어요.\n잠시후 다시 시도해 주세요.",
                'menu_cal': "",
                'date': MLSV_YMD_f
            });
            return;
        }
    }
});

exports.app = onRequest(app);
