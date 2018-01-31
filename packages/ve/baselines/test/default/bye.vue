<template>
    <p>Bye {{name}}</p>
</template>

<script>
import Vue from "vue";
import {foo} from './jsx'
export default Vue.extend({
    data() {
        return {
            name: 'foobar',
        }
    },
    methods: {
        async doStuff() {
            // JSDoc type annotations only work in JavaScript files
            /** @type {PromiseLike<string>} */
            let p = null;
            let v = null;
            await p;
            v;
            ~~ [error no-unused-expression: This expression is unused. Did you mean to assign a value or call a function?]
            await foo();
            await Promise.resolve();
        }
    },
});
</script>

<style>
</style>
