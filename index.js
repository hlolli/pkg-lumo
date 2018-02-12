#!/usr/bin/env node

const chalk = require('chalk');
const clear = require('clear');
const figlet = require('figlet');
const fs = require('fs');
const fse = require('fs-extra');
const inquirer = require('inquirer');
const mkdirp = require('mkdirp');
const path = require('path');
const rmdir = require('rimraf');
const JSZip = require('jszip');
const os = require('os');

const lumoVersion = '1.8.0-beta';
const libDir = path.dirname(fs.realpathSync(__filename));

console.log(
    chalk.yellow(
	figlet.textSync('pkg-lumo', { horizontalLayout: 'full' })
    )
);


const prompt = [
    {
        name: 'classpath',
        type: 'input',
        message: 'colon seperated project classpath:',
    },
    {
        name: 'resourceDirs',
        type: 'input',
        message: 'colon seperated directory path(s) to embedded resources:',
    },
    {
        name: 'mainNsName',
        type: 'input',
        message: 'Main namsepace name:',
    }
];

function deleteIfExists(filePath) {
    if (fs.existsSync(filePath)) {
	fs.unlinkSync(filePath);
    }
}

function writeFileAndDir(filePath, contents) {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
	fs.writeFileSync(filePath, contents);
    } else {
	mkdirp.sync(dirname);
	writeFileAndDir(filePath, contents);	
    }
}


function removeEmptyStringFromArray (value) {
    return value.filter(function (item) {
	return item !== '';
    });
}

function extractTarget() {
    var zipFilePath = path.join(libDir, 'target-' + lumoVersion + '.zip');
    var fileContents = fs.readFileSync(zipFilePath);
    var zipped = new JSZip().load(fileContents);
    for (var file in zipped.files) {
	var content = zipped.file(file);
	var dest = path.join(process.cwd(), file);
	if (content && !content.options.dir) {
	    // console.log(dest, content.options.dir);
	    writeFileAndDir(dest, content.asNodeBuffer());
	}
    }
}

function extractLumo() {
    var zipFilePath = path.join(libDir, 'lumo-' + lumoVersion + '.zip');
    var fileContents = fs.readFileSync(zipFilePath);
    var zipped = new JSZip().load(fileContents);
    for (var file in zipped.files) {
	var content = zipped.file(file);
	var dest = path.join(process.cwd(), file);
	if (content && !content.options.dir) {
	    // console.log(dest, content.options.dir);
	    writeFileAndDir(dest, content.asNodeBuffer());
	}
    }
    console.log('installing lumo npm deps...');
    var child_process = require('child_process');
    child_process.execSync('npm install',
			   {stdio:[0,1,2],
			    cwd: path.join(process.cwd(), 'lumo-' + lumoVersion)});
    // var bundleJs = fs.createReadStream(path.join(libDir, 'bundle.js'));
    // fs.writeFileSync(path.join(process.cwd(), 'target', 'lumo-' + lumoVersion, 'bundle.js'),
    // 		     bundleJs,{encoding:'utf8',flag:'w'})
}


function patchLumoSources() {
    var copyPatch = function(src, dest) {
	try {
	    console.log(`Copying patch ${path.basename(src)}`);
	    fse.copySync(src, dest, {overwrite: true});
	} catch (err) {
	    console.error(`Error copying patch ${path.basename(src)}`, err);
	}
    }
    var patchDir    = path.join(libDir, 'patch-' + lumoVersion);
    var lumoSources = path.join(process.cwd(), 'lumo-' + lumoVersion);
    copyPatch(path.join(patchDir, 'package.js'), path.join(lumoSources, 'scripts', 'package.js'));
    copyPatch(path.join(patchDir, 'pkg-bundle.js'), path.join(lumoSources, 'scripts', 'pkg-bundle.js'));
    copyPatch(path.join(patchDir, 'requirePatch.js'), path.join(lumoSources, 'scripts', 'requirePatch.js'));
    copyPatch(path.join(patchDir, 'embed.js'), path.join(lumoSources, 'scripts', 'embed.js'));
}

function bundle(options) {
    const tmpLumoDir = path.join(process.cwd(), 'lumo-' + lumoVersion);
    const emptyOptions = {mainNsName: '',
			  classpath: [],
			  repl: false,
			  scripts: [],
			  dependencies: [],
			  unrecognized: false,
			  quite: false,
			  'dumb-terminal': false,
			  version: false,
			  leagal: false,
			  verbose: false,
			  'static-fns': false,
			  'elide-asserts': false,
			  args: []};
    
    options = Object.assign(emptyOptions, options, {classpath: []});   
    deleteIfExists(path.join(tmpLumoDir, 'target/bundle.min.js'));
    deleteIfExists(path.join(tmpLumoDir, 'target/bundle.js'));
    var child_process = require('child_process');
    
    child_process.execSync(`node scripts/pkg-bundle.js '${JSON.stringify(options)}'`,
			   {stdio:[0,1,2],
			    cwd: tmpLumoDir});
}

function bundleNodeModules() {
    if (fs.existsSync('./package.json')) {
	var node_modules_exists = fs.existsSync('./node_modules');
	if(node_modules_exists) {
	    fse.moveSync('./node_modules', './node_modules_bak', {overwrite: true});
	}
	console.log('installing production node modules via `npm install --production`');
	var child_process = require('child_process');
	child_process.execSync(`npm install --production`, {stdio:[0,1,2]});
	console.log('moveing node_modules to be bundled');
	fse.moveSync('./node_modules',
		     path.join(process.cwd(), 'lumo-' + lumoVersion, 'target', 'node_modules'),
		     {overwrite: true});
	if(node_modules_exists) {
	    fse.moveSync('./node_modules_bak', './node_modules');
	}
    } else {
	console.log('No package.json found, no npm deps will be bundled');
    }
}

function bundleResources(resourceDirsArray) {
    resourceDirsArray.forEach(resourceDir => {
	if (fs.existsSync(resourceDir)) {
	    var dest = path.join(process.cwd(),
				 'lumo-' + lumoVersion,
				 'target',
				 path.basename(resourceDir));
	    try {
		console.log(`Bundling resource directory: ${resourceDir}`);
		fse.copySync(resourceDir, dest, {overwrite: true});
	    } catch (err) {
		console.error(`Error copying resourceDir ${resourceDir}`, err);
	    }
	} else {
	    console.log(`WARNING! Specified resource dir ${resourceDir} was not found!`);
	}
    });
}

function generateAOT(options) {
    console.log(`Installing lumo-${lumoVersion} from npm...`);
    
    var child_process = require('child_process');
    child_process.execSync(`npm install lumo-cljs@${lumoVersion} --no-save`,
			   {stdio:[0,1,2]});
    
    const isWindows = process.platform === 'win32';
    const aotTarget = path.join(process.cwd(), 'lumo-' + lumoVersion, 'target', 'aot');

    console.log(`Generateing AOT from main namespace: ${options.mainNsName}`)
    child_process.execSync(`./node_modules/lumo-cljs/bin/lumo${(isWindows) ? '.exe' : ''} ` +
			   `--quiet -c ${options.classpath} -sdfk ${aotTarget}` +
			   ` -e "(require '${options.mainNsName}) (.exit js/process 0)"`,
			   {stdio:[0,1,2]});
}

function packageNexe() {
    const tmpLumoDir = path.join(process.cwd(), 'lumo-' + lumoVersion);
    console.log('Generateing the nexe executeable, this may take a while and consume a lot of memory.')
    var child_process = require('child_process');
    child_process.execSync(`node scripts/package.js`,
			   {stdio:[0,1,2],
			    cwd: tmpLumoDir});
}

function cleanUp() {
    var binaryLocation = path.join(process.cwd(),
				   'lumo-' + lumoVersion,
				   'build',
				   `${/^Windows/.test(os.type()) ? 'lumo.exe' : 'lumo'}`);
    var binaryName = `${/^Windows/.test(os.type()) ? './my-lumo.exe' : './my-lumo'}`;
    fse.moveSync(binaryLocation,
		 binaryName,
		 {overwrite: true});
    
    rmdir(path.join(process.cwd(), 'lumo-' + lumoVersion), error => {
	console.log(`Finished building. Your nexe binary is called ${binaryName}`);
    });
}

inquirer.prompt(prompt).then(res => {

    var resourceDirsArray = res.resourceDirs.split(':');
    resourceDirsArray = removeEmptyStringFromArray(resourceDirsArray);

    rmdir(path.join(process.cwd(), 'lumo-' + lumoVersion), error => {
	extractLumo();
	patchLumoSources();
	bundle(res);
	bundleNodeModules();
	bundleResources(resourceDirsArray);
	generateAOT(res);
	packageNexe();
	cleanUp();
    });
});
