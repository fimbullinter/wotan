continue foo;
break foo;

for (;;)
    break;
while (false)
    continue;

block: {
    break block;
}

statement: if (true)
    break statement;

statement: {
    for (;;)
        continue statement;
}

outer: while (true)
    for (;;)
        break outer;

outer: while (true)
    for (;;)
        continue outer;

outer: inner: while (true) {
    switch (0 as number) {
        case 0:
            continue;
        case 1:
            break;
        case 2:
            continue;
        case 3:
            break outer;
    }
    if (Boolean())
        break;
    else
        continue;
}

outer: while (true)
    inner: do
        break outer;
    while (true);
