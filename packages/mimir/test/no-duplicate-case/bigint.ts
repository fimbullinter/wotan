switch (get<any>()) {
    case 1:
    case 1n:
    case ~-2n:
    case -1n:
    case ~0n:
    case true:
    case false:
    case !0n:
    case !-1n:
    case +1n:
    case +-1n:
    case '1n':
    case 99n:
    case ~-100n:
    case -100n:
    case ~99n:
    case 0n:
    case ~-1n:
    case get<1n>():
    case -get<1n>():
    case -get<0n>():
}
