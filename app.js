/**
 * Created by Administrator on 2016/9/3.
 */
'use strict'

var koa = require('koa');
var wechat = require('./wechat/g');
var config = require('./config');
var weixin = require('./wx/reply');   //自定义模块，主要用于回复
let crypto = require('crypto');
let Wechat = require('./wechat/wechat');


var app = new koa();

let ejs = require('ejs');
let heredoc = require('heredoc');



//signature(签名)需要放在服务端做，是最容易出错的环节
//生成signature需要４个要素：
//１．时间截
//２．当前页面的url
//３．票据
//４．随机串
let tpl = heredoc(function() {/*
  <!DOCTYPE html>
  <html>
  <head>
    <title>猜电影</title>
    <meta name="viewport" content="initial-scale=1, maximum-scale=1, minimum-scale=1">
  </head>
  <body>
    <h1>点击标题,开始录音翻译</h1>
    <p id="titile"></p>
    <div id="director"></div>
    <div id="year"></div>
    <div id="poster"></div>
    <script src="http://zeptojs.com/zepto-docs.min.js"></script>
    <script src="http://res.wx.qq.com/open/js/jweixin-1.0.0.js"></script>
    <script>
    console.log("3333333333333333333333333333");
      wx.config({
        debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
        appId: 'wxb80e5bddb2d804f3', // 必填，公众号的唯一标识
        timestamp: '<%= timestamp %>', // 必填，生成签名的时间戳
        nonceStr: '<%= noncestr %>', // 必填，生成签名的随机串
        signature: '<%= signature %>',// 必填，签名，见附录1
        jsApiList: [
          'startRecord',
          'stopRecord',
          'onVoiceRecordEnd',
          'downloadImage',
          'translateVoice',
          'onMenuShareTimeline',
          'onMenuShareAppMessage',
          'onMenuShareQQ',
          'onMenuShareWeibo',
          'onMenuShareQZone',
          'previewImage'

        ] // 必填，需要使用的JS接口列表，所有JS接口列表见附录2
      });
      wx.error(function(res){
        alert("2222222222")
        console.log("hhhhhhhhhhhhhhhhhhhhhhhhhhh");
      })
      wx.ready(function(){
        wx.checkJsApi({
          jsApiList: ['onVoiceRecordEnd'], // 需要检测的JS接口列表，所有JS接口列表见附录2,
          success: function(res) {
            console.log(res);
          },
        });

        let shareContent = {
          title: 'sousousou', // 分享标题
          desc: '我搜出来了啥' , // 分享描述
          link: 'https://github.com', // 分享链接
          imgUrl: 'http://wx4.sinaimg.cn/mw690/703021d1ly1fcza0mvhp7j20qo0fw40i.jpg', // 分享图标
          success: function () { 
            window.alert('分享成功');
          },
          cancel: function () { 
            window.alert('分享失败');
          }
        };
        wx.onMenuShareAppMessage(shareContent);

        let slides;
        let isRecording = false;

        $('#poster').on('tap', function() {
          wx.previewImage(slides);
        });

        $('h1').on('tap', function(){
          if(!isRecording){
            isRecording = true;
            wx.startRecord({
              cancel:function() {
                window.alert('你取消了录音!');
              }
            });
            return ;
          }
          isRecording = false;
          wx.stopRecord({
            success: function(res){
              let localId = res.localId;
              wx.translateVoice({
                localId: localId,
                isShowProgressTips: 1, // 默认为1，显示进度提示
                success: function (res) {
                  let result = res.translateResult;
                  $.ajax({
                    type: 'get',
                    url:'https://api.douban.com/v2/movie/search?q=' + result,
                    dataType: 'jsonp',
                    jsonp: 'callback',
                    success: function(data) {
                      console.log("ddddddddddddd");
                      console.log(data);
                      let subject = data.subjects[0];
                      console.log(subject);
                      $('#title').html(subject.title);
                      $('#year').html(subject.year);
                      $('#director').html(subject.directors[0].name);
                      $('#poster').html('<img src="'+ subject.images.large + '" />');
                      shareContent = {
                        title: subject.title, // 分享标题
                        desc: '我搜出来了' +　subject.title, // 分享描述
                        link: 'https://github.com', // 分享链接
                        imgUrl: subject.images.large, // 分享图标
                        type: 'link', // 分享类型,music、video或link，不填默认为link
                        dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                        success: function () { 
                          window.alert('分享成功');
                        },
                        cancel: function () { 
                          window.alert('分享失败');
                        }
                      };

                      slides = {
                          current: subject.images.large,
                          urls:[subject.images.large]
                      };
                      data.subjects.forEach(function(item) {
                        slides.urls.push(item.images.large)
                      });
                      wx.previewImage({
                        current: '', // 当前显示图片的http链接
                        urls: [] // 需要预览的图片http链接列表
                      });
                      wx.onMenuShareAppMessage(shareContent);
                    }
                  }); 
                }
              });
            }
          });
        });
      });
       
      

    </script>
  </body>
  </html>
*/});

//生成随机数
let createNonce = function() {
  return Math.random().toString(36).substr(2, 15);
};
//生成时间截
let createTimestamp = function() {
  return parseInt(new Date().getTime() / 1000, 10) + '';
};
//实现签名
let _sign = function(noncestr, ticket, timestamp, url) {
  let params = [
    'noncestr=' + noncestr,
    'jsapi_ticket=' + ticket,
    'timestamp=' + timestamp,
    'url=' + url
  ];
  let str = params.sort().join('&');
  console.log("cccccccccccccccccccccccc");
  console.log(str)
  let shasum = crypto.createHash('sha1');
  shasum.update(str);
  return shasum.digest('hex');
}
function sign(ticket, url) {
  let noncestr = createNonce();
  let timestamp = createTimestamp();
  let signature = _sign(noncestr, ticket, timestamp, url);

  return {
    noncestr: noncestr,
    timestamp: timestamp,
    signature: signature
  };
}


app.use(function *(next){
  if(this.url.indexOf('/movie') > -1) {
    let wechatApi = new Wechat(config.wechat);    
    let data = yield wechatApi.fetchAccessToken();
    let access_token = data.access_token;

    let ticketData = yield wechatApi.fetchTicket(access_token);
    let ticket = ticketData.ticket;
    let url = this.href;
    let params = sign(ticket, url);
    console.log("vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv");
    console.log(ticket);
    console.log(url)
    console.log(params);
    this.body = ejs.render(tpl, params);

    return next;
  }
});


app.use(wechat(config.wechat,weixin.reply));

app.listen(1234);

console.log('Listening:1234');
