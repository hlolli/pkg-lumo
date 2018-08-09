pkg-lumo is full of hacks and can be pain to upgrade, so here's a checklist to go over when upgrading pkg-lumo in respect to new lumo releases.

1. Precompile lumo with `boot release-ci`, comment out the last stage so that the last thing done is running the aot script.
2. Remove `node_modules` and `tmp` and zip the directory, it should be around 60-70 mb.
3. Change lumo version number in index.js and node version number in patches/package.js
