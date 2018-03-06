debugger;
label: debugger
if (foo)
    debugger;
else {
    debugger;
}
foo.debugger;
foo.debugger();
"debugger";
"debugger;";
for (;;) debugger
do
    debugger
while (true)
`
    debugger
    debugger;
`

class Foo {
    debugger;
    static debugger;
}
// debugger;
debugger;
debugger // end of line comment
debugger /* multiline
            comment */
