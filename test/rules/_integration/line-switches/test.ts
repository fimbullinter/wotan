foo:;
bar:; // wotan-disable-line
baz:; /* wotan-disable-line */
/* wotan-disable-line */ bas:;

foo:; // wotan-disable-next-line
bar:;
// wotan-disable-next-line
baz:;
bas:;

/* wotan-disable-next-line */ foo:;
bar:;
/* wotan-enable-next-line */ baz:;
bas:;

/* wotan-disable */foo:;// wotan-enable
bar/* wotan-disable */:; /* wotan-enable */
/* wotan-disable */baz:/* wotan-enable */bas:;

// wotan-disable
// wotan-disable-next-line
foo:;
bar:; // wotan-disable-line
baz:; // wotan-disable
bas:;

foo:; // wotan-enable-line
bar:;
baz:; // wotan-enable-next-line
bas:;

/* wotan-enable-next-line */ foo:;
bar:;
