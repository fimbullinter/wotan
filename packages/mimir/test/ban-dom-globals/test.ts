name;
window.name;
new Event('click');
event instanceof Event;
let e: typeof event;

alert(confirm(prompt('foo?') || ''));
URL.createObjectURL(null);

clearTimeout(setTimeout(() => {}));
clearImmediate(setImmediate(() => {}));
clearInterval(setInterval(() => {}));
cancelAnimationFrame(requestAnimationFrame(() => {}));

document.location;
location;
window.location;
navigator.geolocation;
btoa(atob(''));
console.log('foo');
fetch('foo');

sessionStorage;
localStorage;
indexedDB;

function test() {
    let event: Event = null!;
    event;
    function onclick() {}
    onclick();
}

open('');
addEventListener('click', () => {});
window.addEventListener('click', () => {});

eval(';');

type t = Window;
let v: t;

foobar;

for (let i = 0; i < 10; ++i);

{
    class c {};
    c;
    const {target} = event!;
    target;
}
