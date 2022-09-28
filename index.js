// Packages
const fs = require("fs");
const path = require("path");
const $ = require("./utils/jquery")
// Set Up Environment
const ____CONFIGPATH = path.join(__dirname,"config.json");
if(!fs.existsSync(____CONFIGPATH)) fs.writeFileSync(____CONFIGPATH,"{}");
var ____CONFIG = JSON.parse(fs.readFileSync(____CONFIGPATH));
function saveConfig(){fs.writeFileSync(____CONFIGPATH,JSON.stringify(____CONFIG));}
var config = new Proxy(____CONFIG, {
	get: function(t,p,r){
		return Reflect.get(____CONFIG,p,r);
	},
	set: function(t,p,v,r){
		Reflect.set(____CONFIG,p,v,r);
		saveConfig();
	}
});
function formatNumber(x) {return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");}
// Constants
const backend = require("./backend")(window,config);
// Variables
var region, account, session, accountDeleteMode = false;
// Functions
function dconfirm(text,callback,t1,t2="Cancel",c1="danger",c2="primary"){
	$("div#confirm-message span").text(text);
	$("div#confirm-message button:first-of-type").text(t1);
	$("div#confirm-message button:nth-of-type(2)").text(t2);
	$("div#confirm-message button:first-of-type").attr("class","btn btn-"+c1);
	$("div#confirm-message button:nth-of-type(2)").attr("class","btn btn-"+c2);
	document.querySelector("div#confirm-message button:first-of-type").onclick = callback;
	config.overlay = "div#confirm-message";
}
function updateUserBar(v){
	$("#name").text(v.user.name);
	$("#rank").text(v.user.rank);
	$("#zeni").text(formatNumber(v.user.zeni));
	$("#dragon-stones").text(formatNumber(v.user.stone));
}
function weirdlink_0(e){
	e.onclick = function(){
		if(accountDeleteMode){
			var h = parseInt(e.getAttribute("bruhnumber"));
			var i = config[region+"_accounts"][h];
			dconfirm(`Are you sure you want to delete "${i.name}" (ID: ${i.id})?`,function(){
				config[region+"_accounts"][h]=3;
				config[region+"_accounts"]=config[region+"_accounts"].filter(v=>v!=3);
				e.parentElement.parentElement.remove();
				for(var j of document.querySelectorAll("div#account-menu>div tbody tr a")){
					var k = parseInt(j.getAttribute("bruhnumber"));
					j.setAttribute("bruhnumber",(k>h?k-1:k).toString());
				}
				config.overlay = "";
			},"Delete");
		}else{
			account = config[region+"_accounts"][parseInt(e.getAttribute("bruhnumber"))];
			backend.signin(account,region,true).then(function(value){
				session = value;
				backend.user(account,session,region).then(function(v){
					updateUserBar(v);
					$("div#account-info").css("display","block");
					config.page = "div#main-menu";
					backend.get_story_events(account,session,region).then(function(v){
						console.log(v);
					});
				});
			});
		}
	};
}
function setupAccountView(reg){
	region = reg;
	accountDeleteMode = false;
	$("div#account-menu>div tbody").html("");
	for(var h in config[reg+"_accounts"]){
		var i = config[reg+"_accounts"][h];
		$("div#account-menu>div tbody").append(`<tr><td>${i.id}</td><td><a href="#1" bruhnumber="${h}">${i.name}</a></td><td>${i.platform=="ios"?"IOS":"Android"}</td><td>${i.rank?i.rank:"????"}</td><td>${i.stones?i.stones:"????"}</td></tr>`);
		weirdlink_0(document.querySelector("div#account-menu>div tbody tr:last-child a"));
	}
	config.page = "div#account-menu";
}
// Startup
document.addEventListener("DOMContentLoaded",async function(){
	config.page = "div#loading-screen";
	backend.setup_dom();
	await backend.ping();
	await backend.update_database("glb");
	await backend.update_database("jpn");
	if(!config.glb_accounts) config.glb_accounts = [];
	if(!config.jpn_accounts) config.jpn_accounts = [];
	var stats = backend.__retrieve_data();
	$("div#region-menu textarea:first-of-type").val(`Version: ${stats.hash.glb.split("-")[0]}\nHost: ${stats.baseUrl.glb}\nPort: ${stats.port.glb}\nCF-Host: ${stats.cfUrl.glb}\nVersion-Hash: ${stats.hash.glb}`);
	$("div#region-menu textarea:nth-of-type(2)").val(`Version: ${stats.hash.jpn.split("-")[0]}\nHost: ${stats.baseUrl.jpn}\nPort: ${stats.port.jpn}\nCF-Host: ${stats.cfUrl.jpn}\nVersion-Hash: ${stats.hash.jpn}`);
	$("div#region-menu button:first-of-type").on("click",function(){setupAccountView("glb")});
	$("div#region-menu button:nth-of-type(2)").on("click",function(){setupAccountView("jpn")});
	$("div#overlay").on("click",function(){config.overlay = ""});
	$("div#overlay>div").on("click",function(ev){ev.stopPropagation();})
	$("div#account-menu button:first-of-type").on("click",function(){config.overlay = "div#account-creator";});
	$("div#account-menu button:nth-of-type(3)").on("click",function(){
		accountDeleteMode = !accountDeleteMode;
		if(accountDeleteMode){
			$("div#account-menu button:nth-of-type(3)").attr("class","btn btn-success");
			$("div#account-menu button:nth-of-type(3)").text("Exit Delete Mode");
			for(var i of document.querySelectorAll("div#account-menu button")){if(!i.classList.contains("btn-success")){i.setAttribute("disabled","");}}
			$("div#account-menu>div tbody tr a").css("color","#f00");
		}else{
			$("div#account-menu button:nth-of-type(3)").attr("class","btn btn-danger");
			$("div#account-menu button:nth-of-type(3)").text("Delete Account");
			for(var i of document.querySelectorAll("div#account-menu button")){i.removeAttribute("disabled");}
			$("div#account-menu>div tbody tr a").removeAttr("style");
		}
	});
	$("div#account-menu button:nth-of-type(4)").on("click",function(){config.page = "div#region-menu";});
	$("div#overlay div#account-creator button").on("click",function(){
		var p = document.querySelector("div#overlay div#account-creator select");
		p = p.options[p.selectedIndex].text.toLowerCase();
		backend.signup(region,p,false).then(function(value){
			var e = $("div#overlay div#account-creator span:last-of-type");
			if(value.basic==""){
				e.css("color","#a00");
				e.text("Error: You must complete the captcha");
			}else{
				e.css("color","#aaa");
				e.text("Completing tutorial...");
				backend.complete_tutorial(value,region).then(function(u){
					value.name = u.user.name;
					config[region+"_accounts"].push({...value, stones: u.user.stone, rank: u.user.rank});
					saveConfig();
					$("div#account-menu>div tbody").append(`<tr><td>${value.id}</td><td><a href="#1" bruhnumber="${config[region+"_accounts"].length-1}">${value.name}</a></td><td>${value.platform=="ios"?"IOS":"Android"}</td><td>${u.user.rank}</td><td>${u.user.stone}</td></tr>`);
					weirdlink_0(document.querySelector("div#account-menu>div tbody tr:last-child a"));
					e.css("color","#0a0");
					e.text("Success! The account name is \""+value.name+"\"");
				});
			}
		});
	});
	$("div#confirm-message button:nth-of-type(2)").on("click",function(){config.overlay="";});
	config.page = "div#region-menu";
});