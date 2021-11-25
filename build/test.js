"use strict";
var functionList = [
    (allow) => { console.log("A"); allow(); },
    (allow) => { console.log("B"); allow(); },
    (allow) => { console.log("C"); /*allow();*/ },
    (allow) => { console.log("D"); allow(); },
    (allow) => { console.log("E"); allow(); },
];
parseFunctionList(functionList, () => console.log("done"));

function parseFunctionList(list, allowed, i = 0) {
    if (list.length <= i) {
        allowed();
        return false;
    }
    list[i](() => parseFunctionList(list, allowed, i + 1));
    return true;
}
//# sourceMappingURL=test.js.map