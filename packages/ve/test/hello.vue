<template>
    <div>
        <input type="text">
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import {foo} from './jsx'
export default Vue.extend({
    data() {
        return {}
    },
    methods: {
        async doStuff() {
            // JSDoc type annotations only work in JavaScript files
            /** @type {PromiseLike<string>} */
            let p = null;
            let v = null;
            await p;
            await v;
            await foo();
            await Promise.resolve();
        }
    },
});
</script>

<style>
</style>
