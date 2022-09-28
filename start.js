// Packages
const electron = require("electron");
const {app} = electron;
// Start
var ready = function(){
	var w = new electron.BrowserWindow({
		webPreferences: {
			nodeIntegration: true
		},
		show: false,
		width: 600,
		height: 400,
		resizable: false
	});
	w.setMenuBarVisibility(false);
	w.loadFile("index.html");
	w.on("ready-to-show",function(){
		w.show();
	});
	w.on("closed",function(){
		app.exit();
	});
};
app.whenReady().then(function(){ready();});