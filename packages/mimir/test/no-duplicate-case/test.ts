declare let foo: any;
declare let bar: any;
declare let baz: any;

switch (foo) {
    case bar:
    case baz:
    case 'bar':
    case 'baz':
    case undefined:
    case 0:
    case -0:
    case null:
}

switch (foo) {
    case bar:
    case baz:
    case bar:
    case 'what\'s up?':
    case "what's up?":
    case `what's up?`:
    case 'wazzup?':
    case 'wassabi?':
    case '1':
    case 1:
    case +1:
    case -+-1:
    case +-1:
    case -+1:
    case ~~'1.1':
    case true:
    case !false:
}
