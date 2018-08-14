const nexe = require('nexe');
const monkeyPatch = require('nexe/lib/monkeypatch');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const embed = require('./embed');
const argv = process.argv.slice(2);
const nodeVersion = '9.11.2';

function getDirContents(dir, accumPath = dir) {
    let filenames = fs.readdirSync(dir);

  return filenames.reduce((ret, filename) => {
    const fname = path.resolve(accumPath, filename);
    if (fname.endsWith('.bin/lumo')) {
        return ret;
    }
    const fStat = fs.statSync(fname);

    if (fStat.isDirectory()) {
      const newAccum = path.join(accumPath, filename);
      return ret.concat(getDirContents(newAccum, newAccum));
    }

    ret.push(path.join(accumPath, filename));
    return ret;
  }, []);
}

function deflate(fname) {
  return new Promise((resolve, reject) => {
    fs.readFile(fname, (err, input) => {
      fs.writeFileSync(fname, zlib.deflateSync(input));
      resolve();
    });
  });
}

function resourceFilter (fname) {
return fname.endsWith('.aot.js.map') ||
      fname.startsWith('target/node_modules') ||
      (!fname.endsWith('target/main.js') &&
       !fname.endsWith('target/bundle.js') &&
       !fname.endsWith('target/bundle.min.js') &&
       !fname.endsWith('target/google-closure-compiler-js.js') &&
       !fname.endsWith('target/aot.edn') &&
       !/target[\\\/]cljs[\\/]core.js/.test(fname))
}

const outputPath = `build/${/^Windows/.test(os.type()) ? 'lumo.exe' : 'lumo'}`;
var resources = getDirContents('target').filter(fname => resourceFilter(fname));


function moveLibs(compiler, options, callback) {
  fs.writeFileSync(
    `${compiler.dir}/google-closure-compiler-js.js`,
    fs.readFileSync(`target/google-closure-compiler-js.js`),
  );

  callback(null, compiler, options);
}


function patchNodeGyp(compiler, options, callback) {
  const gypPath = path.join(compiler.dir, 'node.gyp');

  monkeyPatch(
    gypPath,
    function(content) {
      return ~content.indexOf('google-closure-compiler-js.js');
    },
    function(content, next) {
      const newContent = content.replace(
        "'deps/node-inspect/lib/internal/inspect_repl.js',",
        `'deps/node-inspect/lib/internal/inspect_repl.js',
      'google-closure-compiler-js.js',`,
      );
      next(null, newContent);
    },
    callback,
  );  
}

function patchRequire(compiler, options, callback) {
  const libModulePath = path.join(compiler.dir, 'lib','internal', 'modules', 'cjs', 'loader.js');
  fs.writeFileSync(libModulePath,
		   fs.readFileSync(`scripts/requirePatch.js`),
  );
  callback(null, compiler, options);
}

var patches = [moveLibs, patchNodeGyp];

patches.unshift(patchRequire);

Promise.all(resources.map(deflate)).then(() => {
  embed(resources, 'target');
  
  nexe.compile(
    {
      input: 'target/bundle.min.js',
      output: outputPath,
      nodeTempDir: 'tmp',
      patchFns: patches,
      nodeConfigureArgs: [
        '--without-dtrace',
        '--without-npm',
        '--without-inspector',
        '--without-etw',
        '--without-perfctr',
        '--with-snapshot',
      ],
      nodeMakeArgs: ['-j', '8'],
      nodeVCBuildArgs: ['nosign', 'x64', 'noetw', 'noperfctr'],
      flags: true,
      startupSnapshot: 'target/main.js',
      noBundle: true,
      framework: 'node',
      nodeVersion,
    },
    err => {
      if (err) {
        throw err;
      }
    },
  );
});
