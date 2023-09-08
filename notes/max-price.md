# Max Price Math

This is the script used to generate the values for `maxPriceFromPriceDecimals()` in `ButtonToken.sol`.

```js
function sqrt(value) {
    if (value < 0n) {
        throw 'square root of negative numbers is not supported'
    }

    if (value < 2n) {
        return value;
    }

    function newtonIteration(n, x0) {
        const x1 = ((n / x0) + x0) >> 1n;
        if (x0 === x1 || x0 === (x1 - 1n)) {
            return x0;
        }
        return newtonIteration(n, x1);
    }

    return newtonIteration(value, 1n);
}

var MAX_UINT256 = 2n**256n;
var MAX_UNDERLYING = 1_000_000_000n * (10n**18n);
var TOTAL_BITS = MAX_UINT256 - (MAX_UINT256 % MAX_UNDERLYING);
var BITS_PER_UNDERLYING = TOTAL_BITS / MAX_UNDERLYING;
for (let priceDecimals = 0n; priceDecimals <=18n; priceDecimals++){
    var PRICE_BITS = BITS_PER_UNDERLYING * (10n**priceDecimals);
    var TRUE_MAX_PRICE = (sqrt(4n*PRICE_BITS + 1n) - 1n) / 2n;
    var MAX_PRICE_EXP = BigInt( TRUE_MAX_PRICE.toString(2).length-1);
    var MAX_PRICE = 2n**(MAX_PRICE_EXP)-1n;
    console.log('priceDecimals', priceDecimals, 'MAX_PRICE_EXP', MAX_PRICE_EXP);

}
```