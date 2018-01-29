bar: for (;;) {
    break;
    bar: switch (true) {
        case true:
            break bar;
        default:
            continue bar;
    }
}

foo: for(;;)
    foo: while(true)
        break foo;
break foo;
