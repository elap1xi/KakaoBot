const {onRequest} = require("firebase-functions/v2/https");

require("dotenv").config();
const axios = require('axios');
const express = require('express');
const app = express();

const apiToken_aptdb = process.env.TOKENAPTDB;
const apiToken_neis = process.env.TOKENNEIS;

async function get(url){
    return await axios.get(url).then(res => res.data);
}

app.post('/airportsdb', async (req, res) => {
    const body = req.body;
    const icao = body['userRequest']['utterance'];
    let url = `https://airportdb.io/api/v1/airport/${icao}?apiToken=${apiToken_aptdb}`;

    var json;
    try {
        json = await get(url);
        res.json(json);
    } catch(error) {
        json = { 'error':'에러가 발생했습니다' };
        res.json(json);
    }
});

app.post('/menu', async (req, res) => {
    var DTE = new Date();
    var Year = String(DTE.getFullYear());
    var Month = String(DTE.getMonth()+1);
    var Day = (DTE.getDate());
    Month = Month.length==1 ? `0${Month}` : Month;
    Day = Day.length==1 ? `0${Day}` : Day;
    let MLSV_YMD = `${Year}${Month}${Day}`;
    let MLSV_YMD_f = `${Year}/${Month}/${Day}`;

    let url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=100&KEY=${apiToken_neis}&ATPT_OFCDC_SC_CODE=H10&SD_SCHUL_CODE=7480093&MLSV_YMD=${MLSV_YMD}`;
    
    var json;
    try {
        json = await get(url);
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
            'menu':menu_row,
            'menu_cal':menu_cal,
            'date':MLSV_YMD_f
        });
    } catch(error) {
        json = { 'error':'에러가 발생했습니다' };
        res.json(json);
    }
});

exports.app = onRequest(app);
