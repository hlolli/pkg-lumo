# Info
- `pkg-lumo` is basically a nodejs app that patches node.js and lumo in such a way that you can pack your own self-hosted application in a single binary.
- `pkg-lumo` is just a hobby project and can only compile the latest version of lumo, given that I've configured it to do so
- `pkg-lumo` can load .node dynamic modules, given that the binary is loaded from file but not inside the bundle itself. You application could handle this by spitting the binary to disk before requireing it.
- Each compilation compiles V8 which takes at least 5-10 minutes, in cases where you bundle large amount of data into the binary, you may run out of memory. Consider increasing your swap memory if this happens.


# Installation
```
npm -g install pkg-lumo
```

# Example
For: https://github.com/hlolli/lumo-quiz-game
Goto lumo-quiz-game

```
$ pkg-lumo --classpath `clojure -Scp` --resources resources --main lumo-quiz-game.main
```

