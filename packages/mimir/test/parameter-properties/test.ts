class Pass {
    constructor(private propA: string) {}
}

class Fail {
    public propA: string;
    constructor(propA: string) {
        this.propA = propA;
    }
}
