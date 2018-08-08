const fs = require('fs');
const path = require('path');
const rollup = require('rollup').rollup;
const babel = require('rollup-plugin-babel');
const replace = require('rollup-plugin-replace');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const babelMinify = require('rollup-plugin-babel-minify');
const argv = process.argv.slice(2);
var   opts = argv[0];
opts = JSON.parse(opts);


function writeClojureScriptVersion() {
    const rs = fs.createReadStream('target/cljs/analyzer.js');
    let pos = 0;
    let index = 0;
    let acc = '';
    rs
	.on('data', chunk => {
	    index = chunk.indexOf('\n');
	    acc += chunk;
	    if (index !== -1) {
		rs.close();
	    } else {
		pos += chunk.length;
	    }
	})
	.on('close', () => {
	    const line = acc.slice(0, pos + index);
	    const cljsVersion = /ClojureScript\s([0-9.]+)/.exec(line)[1];
	    fs.writeFileSync('target/clojurescript-version', cljsVersion, 'utf8');
	});
}

writeClojureScriptVersion();

const external = [
    'google-closure-compiler-js',
    'assert',
    'crypto',
    'fs',
    'module',
    'net',
    'os',
    'path',
    'readline',
    'repl',
    'stream',
    'tty',
    'v8',
    'vm',
    'zlib',
];

const plugins = [
    babel(),
    replace({
	values: {
	    'process.env.NODE_ENV': '"production"',
	    'process.env.LUMO_VERSION': '"1.9.0-alpha"',
	},
    }),
    resolve({
	jsnext: true,
	main: true,
	preferBuiltins: true,
    }),
    commonjs({
	include: /posix-getopt|paredit\.js|jszip|pako/,
    }),
];


plugins.push(
    babelMinify({
	comments: false,
	removeConsole: true,
	removeDebugger: true,
    }),
);


function pkgGenerateLumoEntryPoint (options) {
    
    return `import startClojureScriptEngine from './cljs';
          import * as util from './util';
          import * as lumo from './lumo';
          import v8 from 'v8';

          const options = ${JSON.stringify(options)};
          const classpath = options['classpath'];

          if (classpath.length !== 0) {
            const srcPaths = util.srcPathsFromClasspathStrings(classpath);
            options.classpath = srcPaths;
            lumo.addSourcePaths(srcPaths);
          };

          v8.setFlagsFromString('--use_strict');

          startClojureScriptEngine(options);`
};


opts.cache = 'aot';

fs.writeFileSync('src/js/pkg.js',
		 pkgGenerateLumoEntryPoint(opts), (err) => {
		     if (err) {
			 return console.log(err);
		     };
		     console.log('Wrote pkg.js entry point ' + opts);
		 });


rollup({
    input: 'src/js/pkg.js',
    plugins,
    external,
}).then(bundle => {
    bundle.write({
	format: 'cjs',
	file: `target/bundle.min.js`,
	interop: false,
	exports: 'none',
	intro: `;(function(){
"use strict";`,
	outro: '})();',
    });
}) .catch(console.error);


