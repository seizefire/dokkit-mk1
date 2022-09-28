// Packages
const crypto = require("crypto");
const _axios = require("axios");
const axios = _axios.default;
const axiosHTTP = require("axios/lib/adapters/http");
// Constants
const ua = {android: "Dalvik/2.1.0 (Linux; Android 7.0; SM-E7000)", ios: "CFNetwork/808.3 Darwin/16.3.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X)"};
/**
 * For some reason Axios throws 4xx errors so I gotta handle that somehow
 * @param {_axios.AxiosRequestConfig} config
 * @returns {_axios.AxiosPromise}
 */
var bxios = config=>new Promise(function(resolve,reject){
	axios(config).then(function(value){
		resolve(value);
	}).catch(function(reason){
		if(reason.response.status >= 400 && reason.response.status <= 499){
			resolve(reason.response);
		}else{
			reject(reason);
		}
	});
});
/**
 * @typedef DokkanRequestSettings
 * @property {String} pathname The pathname
 * @property {"glb"|"jpn"} region The region
 * @property {String} method The method (GET, POST, PUT, etc.)
 * @property {Object} headers The request headers
 * @property {Object} body The data that you want to send
 * @property {boolean} captcha Whether or not you want the captcha checking to be recursive (leave undefined if there are no captchas)
 * @property {Object} account The user account (required for BASIC/MAC authentication)
 * @property {Object} session The user session (required for MAC authentication)
 * @property {Array} autoheaders Headers to automatically fill in (e.g. X-ClientVersion, X-Language)
 * @property {boolean} cf Whether or not to use the CF URL instead of the normal URL
*/
/**
 * @param {Window} window;
 */
module.exports=exports=function(win,config){
	var ir = {}, vhash = {}, baseUrl = {}, port = {}, cfUrl = {};
	/** @type {HTMLIFrameElement} */
	var iframe,iframeid;
	ir.setupDOM = function(){
		iframe = win.document.querySelector("body div iframe");
		iframeid = "div#"+iframe.parentElement.id;
	};
	// Generate MAC Code
	var generateMacCode = function(method,pathname,region,session){
		var ts = Math.floor(new Date().getTime()/1000);
		var nonce = ts+":"+(32);
		var value = `${ts}\n${nonce}\n${method}\n${pathname}\n${baseUrl[region]}\n${port[region]}\n\n`;
		value = crypto.createHmac("sha256",session.secret).update(value).digest("base64");
		return `MAC id="${session.token}", nonce="${nonce}", ts="${ts}", mac="${value}"`
	};
	// Data
	ir.retrieveData = ()=>({hash:vhash,baseUrl:baseUrl,port:port,cfUrl:cfUrl});
	// Ping
	ir.ping = async function(){
		try {
			var a = (await axios({method:"GET",url:"https://unidokkan.com/api/patcher/version/com.unidokkan.dbzdokkanww"})).data;
			if(!a.result||!a.result.metadata||!a.result.metadata.internal_version) throw new Error("Could not find Global Hash in request: "+JSON.stringify(a));
			vhash["glb"] = a.result.metadata.internal_version;
			a = (await axios({method:"GET",url:"https://unidokkan.com/api/patcher/version/com.unidokkan.dbzdokkan"})).data;
			if(!a.result||!a.result.metadata||!a.result.metadata.internal_version) throw new Error("Could not find Japan Hash in request: "+JSON.stringify(a));
			vhash["jpn"] = a.result.metadata.internal_version;
			a = (await axios({method:"GET",url:"https://ishin-global.aktsk.com/ping",headers:{'X-ClientVersion':vhash["glb"],'X-Language':"en",'X-Platform':"android",'X-UserID':"////"}})).data;
			if(!a.ping_info) throw new Error("Ping on Global server failed: "+JSON.stringify(a));
			baseUrl["glb"]=a.ping_info.host;
			port["glb"]=a.ping_info.port;
			cfUrl["glb"]=a.ping_info.cf_uri_prefix;
			a = (await axios({method:"GET",url:"https://ishin-production.aktsk.jp/ping",headers:{'X-ClientVersion':vhash["jpn"],'X-Language':"en",'X-Platform':"android",'X-UserID':"////"}})).data;
			if(!a.ping_info) throw new Error("Ping on Japan server failed: "+JSON.stringify(a));
			baseUrl["jpn"]=a.ping_info.host;
			port["jpn"]=a.ping_info.port;
			cfUrl["jpn"]=a.ping_info.cf_uri_prefix;
		}catch(err){
			win.alert(err.stack);
			win.close();
		}
	};
	/**
	 * @param {DokkanRequestSettings} options
	 */
	ir.dokkan = async function(options){
		var url = `https://${options.cf?cfUrl[options.region]:baseUrl[options.region]}:${port[options.region]}${options.pathname}`;
		var headers = options.headers||{};
		headers["Content-Type"] = "application/json";
		headers["Accept"] = "*/*";
		if(headers["User-Agent"]) headers["User-Agent"] = ua[headers["User-Agent"]];
		if(options.autoheaders == "default") options.autoheaders = ["X-Platform","X-ClientVersion","X-AssetVersion","X-DatabaseVersion","Authorization MAC"];
		if(options.autoheaders){
			for(var i of options.autoheaders){
				switch(i){
					case "User-Agent":headers["User-Agent"]=ua[options.account.platform];break;
					case "X-Language":headers["X-Language"]="en";break;
					case "X-AssetVersion":headers["X-AssetVersion"]="////";break;
					case "X-ClientVersion":headers["X-ClientVersion"]=vhash[options.region];break;
					case "X-DatabaseVersion":headers["X-DatabaseVersion"]="////";break;
					case "X-Platform":headers["X-Platform"]=options.account.platform;break;
					case "X-UserCountry":headers["X-UserCountry"]="US";break;
					case "X-UserCurrency":headers["X-UserCurrency"]="USD";break;
					case "Authorization Basic":headers["Authorization"]="Basic "+options.account.basic;break;
					case "Authorization MAC":headers["Authorization"]=generateMacCode(options.method,options.pathname,options.region,options.session);break;
				}
			}
		};
		var data = Object.assign({},options.body);
		var body = (await bxios({
			data: data,
			headers: headers,
			url: url,
			method: options.method,
			adapter: axiosHTTP
		})).data;
		if(options.captcha !== undefined && body.captcha_url){
			var prevpage = config.page, prevover = config.overlay;
			config.page = iframeid;
			config.overlay = "";
			var cont = true;
			while(cont){
				cont = await new Promise(function(resolve){
					iframe.onload = function(){
						iframe.onload = async function(){
							body = (await bxios({
								data: Object.assign({captcha_session_key: body.captcha_session_key},data),
								headers: headers,
								url: url,
								method: options.method,
								adapter: axiosHTTP
							})).data;
							if(body.captcha_result=="failed"){
								body = (await bxios({
									data: data,
									headers: headers,
									url: url,
									method: options.method,
									adapter: axiosHTTP
								})).data;
								resolve(options.captcha);
							}else if(body.captcha_result){
								resolve(false);
							}else{
								win.alert("Unexpected captcha error: "+JSON.stringify(body));
								win.close();
							}
						};
					};
					iframe.src = body.captcha_url;
				});
			}
			config.page = prevpage;
			config.overlay = prevover;
		}
		return body;
	};
	return ir;
};