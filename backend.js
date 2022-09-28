// Packages
const fs = require("fs");
const path = require("path");
const axios = require("axios").default;
const crypto = require("crypto");
const sqlcipher = require("./utils/sqlcipher");
const axiosHTTP = require("axios/lib/adapters/http")
// Constants
const mc = new require("console").Console(process.stdout,process.stderr);
// Extras
var log = function(txt,ea=[]){mc.log("%c[Dokkit] %c"+txt,"font-weight: bold; color: #00f;","",...ea);console.log("%c[Dokkit] %c"+txt,"font-weight: bold; color: #00f;","",...ea);};
var hex = len=>crypto.randomBytes(Math.ceil(len/2)).toString("hex").substring(0,len);
var _aid = ()=>`${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
var _uid = ()=>`${_aid()}:${hex(8)}`;
/**
 * @typedef DokkanAccount
 * @prop {String} name
 * @prop {Number} id
 * @prop {String} uid
 * @prop {String} aid
 * @prop {"android"|"ios"} platform
 * @prop {String} basic
 * @prop {Number} zeni
 * @prop {Number} stones
 */
/**
 * @typedef DokkanSession
 * @prop {String} token
 * @prop {String} secret
 */
/**
 * Generates a usable BASIC code from a raw code (this is used post-signup and post-transfer)
 * @param {String} raw The raw code
 * @returns {String}
 */
var generateBasicCode = function(raw){
	do{raw=raw.replace("\n","");}while(raw.includes("\n"));
	raw = atob(raw).split(":");
	return btoa(raw[1]+":"+raw[0]);
};
// Main
/** @param {Window} window */
module.exports=exports=function(window,config){
	const irequest = require("./utils/ishinrequest")(window,config);
	var dkn = {};
	var __status;
	var status = function(text){
		__status.innerText=text;
	};
	/** @returns {never} */
	var xlert = function(txt){
		window.alert(txt);
		window.close();
	}
	dkn.setup_dom = function(){
		__status = window.document.querySelector("span#loading-text");
		irequest.setupDOM();
	};
	dkn.__retrieve_data = irequest.retrieveData;
	dkn.ping = irequest.ping;
	// Main Functions
	/**
	 * Performs a signup
	 * @param {("glb"|"jpn")} region
	 * @param {("android"|"ios")} platform
	 * @param {Boolean} recursive
	 * @param {String} [uid]
	 * @param {String} [aid]
	 * @returns {Promise<DokkanAccount>}
	*/
	dkn.signup = async function(region,platform,recursive,uid=_uid(),aid=_aid()){
		var body = await irequest.dokkan({
			pathname: "/auth/sign_up",
			method: "POST",
			body: {
				user_account: {
					ad_id: aid,
					country: "US",
					currency: "USD", 
					device: platform=="ios"?"iPhone":"SM",
					device_model: platform=="ios"?"iPhone 8":"SM-E7000",
					os_version: platform=="ios"?"13.0":"7.0",
					platform: platform,
					unique_id: uid
				}
			},
			headers: {
				"X-Platform": platform,
				"User-Agent": platform
			},
			autoheaders: ["X-ClientVersion"],
			captcha: recursive,
			region: region
		});
		console.log(body);
		if(body.identifier){
			return {name: body.user.name, id: body.user.id, basic: generateBasicCode(body.identifier), uid: uid, aid: aid, platform: platform};
		}
		return {name:"",id:0,basic:"",uid:"",aid:"",platform:platform};
	};
	/**
	 * Signs in
	 * @param {DokkanAccount} account
	 * @param {("glb"|"jpn")} region
	 * @param {boolean} [recursive]
	 * @returns {Promise<DokkanSession>}
	 */
	dkn.signin = async function(account,region,recursive=true){
		var body = await irequest.dokkan({
			pathname: "/auth/sign_in",
			method: "POST",
			autoheaders: ["Authorization Basic","X-ClientVersion","X-Language","X-UserCountry","X-UserCurrency","X-Platform","User-Agent"],
			body: {ad_id: account.aid, unique_id: account.uid},
			account: account,
			captcha: recursive,
			region: region
		});
		return {token: body.access_token, secret: body.secret};
	};
	/**
	 * Updates databases based on region
	 * @param {("glb"|"jpn")} region The region
	 */
	dkn.update_database = region=>new Promise(async function(resolve,reject){
		var z = region=="glb"?"Global":"Japanese";
		if(!config["dbacc_"+region]){
			status(`Creating ${z} database account`);
			config["dbacc_"+region] = await dkn.signup(region,"android",true);
		}
		var acc = config["dbacc_"+region];
		status(`Signing into ${z} database account`);
		var session = await dkn.signin(acc,region,true);
		try {
			status(`Checking for ${z} database updates...`);
			var body = await irequest.dokkan({
				pathname: "/client_assets/database",
				method: "GET",
				headers: {
					"X-AssetVersion": "////",
					"X-DatabaseVersion": "////"
				},
				autoheaders: ["X-Platform","X-ClientVersion","X-Language","Authorization MAC","User-Agent"],
				account: acc,
				session: session,
				region: region
			});
			if(!body.version) xlert("Unable to find database version: "+JSON.stringify(body));
			if(config["dbver_"+region] != body.version){
				if(!body.url) xlert("No database URL?!?! Very cringe Bandco! "+JSON.stringify(body));
				var dbstream = await axios({url:body.url,method:"GET",responseType:"stream",adapter:axiosHTTP});
				var temppath = path.join(__dirname,"tempdb_"+region+".db");
				if(fs.existsSync(temppath)) fs.unlinkSync(temppath);
				status(`Downloading ${z} database`);
				dbstream.data.pipe(fs.createWriteStream(temppath,{flags:"a"})).on("close",function(){
					status(`Decrypting ${z} database`);
					sqlcipher.decryptFile("tempdb_"+region+".db",region+".db",region=="glb"?"9bf9c6ed9d537c399a6c4513e92ab24717e1a488381e3338593abd923fc8a13b":"2db857e837e0a81706e86ea66e2d1633",sqlcipher.SQLCIPHER3,function(){
						fs.unlink("tempdb_"+region+".db",function(){
							config["dbver_"+region] = body.version;
							resolve();
						});
					});
				});
			}else{
				status(`${z} database is up to date`);
				resolve();
			}
		}catch(err){
			xlert(err);
		}
	});
	/**
	 * Gets user data (or puts user data)
	 * @param {DokkanAccount} account The account
	 * @param {DokkanSession} session The session
	 * @param {"glb"|"jpn"} region The region
	 * @param {Object} [override] User data to override
	 */
	dkn.user = (account,session,region,override)=>irequest.dokkan({
		pathname: "/user",
		method: override?"PUT":"GET",
		autoheaders: "default",
		body: override?{user: override}:undefined,
		account: account,
		session: session,
		region: region
	});
	/**
	 * @param {DokkanAccount} account
	 * @param {DokkanSession} session
	 * @param {"glb"|"jpn"} region
	 * @returns {Promise<void>}
	 */
	dkn.accept_apologies = (account,session,region)=>irequest.dokkan({
		pathname: "/apologies/accept",
		method: "PUT",
		autoheaders: "default",
		account: account,
		session: session,
		region: region
	})
	/**
	 * Complete tutorial
	 * @param {DokkanAccount} account
	 * @param {"glb"|"jpn"} region
	 */
	dkn.complete_tutorial = async function(account,region){
		var session = await dkn.signin(account,region,true);
		console.log(await irequest.dokkan({
			pathname: "/tutorial/finish",
			method: "PUT",
			autoheaders: "default",
			account: account,
			session: session,
			region: region
		}));
		console.log(await irequest.dokkan({
			pathname: "/tutorial/gasha",
			method: "POST",
			autoheaders: "default",
			account: account,
			session: session,
			region: region
		}));
		console.log(await irequest.dokkan({
			pathname: "/tutorial",
			method: "PUT",
			autoheaders: "default",
			account: account,
			session: session,
			region: region,
			body: {progress: "999"}
		}));
		console.log(await dkn.user(account,session,region,{name:account.name}));
		console.log(await dkn.accept_apologies(account,session,region));
		return await dkn.user(account,session,region,{is_ondemand:true});
	};
	/**
	 * Get story events
	 * @param {DokkanAccount} account
	 * @param {DokkanSession} session
	 * @param {"glb"|"jpn"} region
	 */
	dkn.get_story_events = (account,session,region)=>irequest.dokkan({
		pathname: "/user_areas",
		method: "GET",
		autoheaders: "default",
		account: account,
		session: session,
		region: region
	});
	return dkn;
};