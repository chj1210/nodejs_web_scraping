const Nightmare = require('nightmare');
const nightmare = Nightmare({ show: true, width: 1280, height: 960 });
const fs = require('fs');

//引入 jQuery 機制
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { window } = new JSDOM();
const $ = require('jquery')(window);

const headers = {
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36',
    'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
};

//放置網頁元素(物件)
let arrLink = [];

//關鍵字
let strKeyword = 'node.js';

//初始化設定
async function init(){
    //若沒有資料夾，則新增
    if( ! await fs.existsSync(`downloads`) ){
        await fs.mkdirSync(`downloads`, {recursive: true});
    }
}

//進行檢索(搜尋職缺名稱)
async function search(){
    console.log('進行檢索(搜尋職缺名稱)');

    //輸入關鍵字，選擇地區，再按下搜尋
    await nightmare
    .goto('https://www.104.com.tw', headers)
    .type('input#ikeyword', strKeyword) //輸入關鍵字
    .wait(2000) //等待數秒
    .click('span#icity') //按下「地區」
    .wait(2000) //等待數秒
    .click('div.second-floor-rect input[value="6001001000"]') //選擇台北市
    .wait(2000)
    .click('div.second-floor-rect input[value="6001002000"]') //選擇新北市
    .wait(2000)
    .click('button.category-picker-btn-primary')
    .wait(2000)
    .click('button.btn.btn-primary.js-formCheck')
    .catch((err) => {
        throw err;
    });
}

//選擇全職、兼職等選項
async function setJobType(){
    console.log('選擇全職、兼職等選項');

    //點選全職
    await nightmare
    .wait(3000)
    .click('ul#js-job-tab > li[data-value="1"]')
    .wait(3000); 
}

//滾動頁面，將動態資料逐一顯示出來
async function scrollPage(){
    console.log('滾動頁面，將動態資料逐一顯示出來');

    /**
     * innertHeightOfWindow: 視窗內 document 區域的內部高度
     * totalOffset: 目前滾動的距離
     */
    let innerHeightOfWindow = 0, totalOffset = 0;

    while(totalOffset <= innerHeightOfWindow){
        //取得視窗內 document 區域的內部高度
        innerHeightOfWindow = await nightmare.evaluate(() => {
            return document.documentElement.scrollHeight;
        });
        //增加滾動距離的數值
        totalOffset += 500;

        //滾動到 totalOffset 指定的距離
        await nightmare.scrollTo(totalOffset, 0).wait(500);

        console.log(`totalOffset = ${totalOffset}, innerHeightOfWindow = ${innerHeightOfWindow}`);

        //接近底部時，按下一頁
        if( (innerHeightOfWindow - totalOffset) < 2000 && await nightmare.exists('button.b-btn.b-btn--link.js-more-page')){
            await _checkPagination();
        }

        //測試用，滾動的距離超過 300，則 scroll() 執行完畢
        if( totalOffset > 300 ){
            break;
        }
    }
}

//按「下一頁」
async function _checkPagination(){
    await nightmare
    .wait('button.b-btn.b-btn--link.js-more-page')
    .click('button.b-btn.b-btn--link.js-more-page');
}

//分析、整理、收集重要資訊
async function parseHtml(){
    console.log('分析、整理、收集重要資訊');

    //取得滾動後，得到動態產生結果的 html 元素
    let html = await nightmare.evaluate(() => {
        return document.documentElement.innerHTML;
    });

    //存放主要資訊的物件
    let obj = {};

    //將重要資掀放到陣列中，以便後續儲存
    $(html)
    .find('div#js-job-content article')
    .each((index, element) => {
        //取得主要資料的 css selector 區域，作為 jQuery 物件
        let elm = $(element).find('div.b-block__left');

        //職缺名稱
        let position = elm.find('h2.b-tit a.js-job-link').text();

        //職缺超連結
        let positionLink = 'https:' + elm.find('h2.b-tit a.js-job-link').attr('href'); 

        //上班地點
        let location = elm.find('ul.b-list-inline.b-clearfix.job-list-intro.b-content li:nth-of-type(1)').text(); 

        //公司名稱
        let companyName = elm.find('ul.b-list-inline.b-clearfix li a').text().trim(); 

        //公司連結
        let companyLink = 'https:' + elm.find('ul.b-list-inline.b-clearfix li a').attr('href'); 

        //產業別
        let category = elm.find('ul.b-list-inline.b-clearfix:nth-of-type(1) li:nth-of-type(3)').text(); 

        //將所有資料以 key-value 格式儲存
        obj.keyword = strKeyword;
        obj.position = position;
        obj.positionLink = positionLink;
        obj.location = location;
        obj.companyName = companyName;
        obj.companyLink = companyLink;
        obj.category = category;

        //放到主要陣列中
        arrLink.push(obj);

        //儲存資訊用的物件化(清空資料)
        obj = {};
    });
}

//接續先前整理的陣列，再繼續往下取得進階資訊
async function getDetailInfo(){
    for(let i = 0; i < arrLink.length; i++){
        //前往影片播放頁面，並取得頁面 html 字串
        let html = await nightmare
        .goto(arrLink[i].positionLink)
        .wait('div.job-description-table.row div.row.mb-2')
        .evaluate(() => {
            return document.documentElement.innerHTML;
        });

        //取得上班地點
        let positionPlace = $(html)
        .find('div.job-description-table.row div.row.mb-2:nth-of-type(4) p.t3.mb-0')
        .text().trim();

        //取得職務類別
        let positionCategory = '';
        let arrTmpConcat = [];
        $(html).find('div.col.p-0.job-description-table__data > div > div > div > u')
        .each(function(index, element){
            arrTmpConcat.push($(element).text().trim());
        });
        positionCategory = arrTmpConcat.join(',');
        

        //在既有 arrLink 陣列當中的各個物件（{key:value, key: value}）中，新增屬性和值
        arrLink[i].positionPlace = positionPlace;
        arrLink[i].positionCategory = positionCategory;
    }
}

//關閉 nightmare
async function close(){
    await nightmare.end(() => {
        console.log(`關閉 nightmare`);
    });
}

async function asyncArray(functionList){
    for(let func of functionList){
        await func();
    }
}

(
    async function (){
        await asyncArray([
            init,
            search, 
            setJobType, 
            scrollPage, 
            parseHtml,
            getDetailInfo,
            close
        ]).then(async () =>{
            console.dir(arrLink, {depth: null});
            await fs.writeFileSync(`downloads/104.json`, JSON.stringify(arrLink, null, 4));
            console.log('Done');
        });
    }
)();