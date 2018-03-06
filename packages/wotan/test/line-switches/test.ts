// wotan-enable my/cool/alias
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

// wotan-enable

// wotan-disable-next-line my/cool/alias
foo:;
debugger;
// wotan-disable-next-line my/cool/alias
foo:; debugger;
// wotan-disable-next-line no-unused-label
foo:; debugger;
// wotan-disable-next-line something-else
foo:; debugger;

"/* wotan-disable */";
debugger;
` // wotan-disable
`; debugger;
/**
 * // wotan-disable
 /* wotan-disable */ debugger;
