const FORMAT = {
    binary16: 'binary16',
    binary32: 'binary32',
    binary64: 'binary64'
};

const _formatId = {
    binary16: 0,
    binary32: 1,
    binary64: 2
};

const NumberProperties = {
    binary16: {
        byteCount: 2,
        bitWidth: 16,
        exponentWidth: 5
    },
    binary32: {
        byteCount: 4,
        bitWidth: 32,
        exponentWidth: 8
    },
    binary64: {
        byteCount: 8,
        bitWidth: 64,
        exponentWidth: 11
    }
};

let currentFormat;
const rawBitPattern = new ArrayBuffer(64);
const fullBitPattern = new Uint8Array(rawBitPattern, 0, 64);


const kLocalStorageKeyFormat = 'me.lukaskollmer.ieee754visualizer.format';
const kLocalStorageKeyBitPattern = 'me.lukaskollmer.ieee754visualizer.bitPattern';


const settings = {
    getFormat: () => {
        return localStorage.getItem(kLocalStorageKeyFormat);
    },

    setFormat: name => {
        localStorage.setItem(kLocalStorageKeyFormat, name);
    },
    
    setBitPattern: () => {
        localStorage.setItem(kLocalStorageKeyBitPattern, JSON.stringify(Array.from(fullBitPattern)));
    },
    
    loadBitPattern: () => {
        const bits = JSON.parse(localStorage.getItem(kLocalStorageKeyBitPattern));
        if (bits === null) return false;
        fullBitPattern.set(bits, 0);
        return true;
    }
};


// TODO: there must be a better way to access a double's internal representation?
const _double2IEEE = value => {
    const buffer = new ArrayBuffer(8);
    const flt64buf = new Float64Array(buffer);
    const uint8buf = new Uint8Array(buffer);
    flt64buf[0] = value;
    return uint8buf;
}


const removeAllChildren = elem => {
    while (elem.firstChild) {
        elem.removeChild(elem.firstChild);
    }
}




const setSelectedFormat = arg0 => {
    document.querySelector('.format-selected').classList.remove('format-selected');
    if (arg0 instanceof MouseEvent) {
        arg0.target.classList.add('format-selected');
        currentFormat = Object.keys(FORMAT)[parseInt(arg0.target.getAttribute('fmt_id'))];
    } else if (typeof arg0 === 'string') {
        currentFormat = arg0;
        document.querySelectorAll('.format-option')[_formatId[arg0]].classList.add('format-selected');
    }
    settings.setFormat(currentFormat);
    setupBitsTable();
    reloadNumber();
}


const allSatisfy = (iterable, fn) => {
    for (let i = 0; i < iterable.length; i++) {
        if (!fn(iterable[i])) return false;
    }
    return true;
}

const allOfValue = (iterable, value) => {
    return allSatisfy(iterable, x => x === value);
}

const sum = input => {
    let retval = 0;
    for (let i = 0; i < input.length; i++) {
        retval += input[i];
    }
    return retval;
}

const reloadNumber = event => {
    const prop = NumberProperties[currentFormat];
    const numBits = prop.byteCount * 8;

    if (event instanceof MouseEvent && event.target.classList.contains('bit')) {
        const value = parseInt(event.target.textContent);
        event.target.textContent = `${1 - value}`;
        fullBitPattern[numBits - 1 - parseInt(event.target.getAttribute('lk_bit_index'))] = 1 - value;
        settings.setBitPattern(fullBitPattern);
    }


    const fractionBitPatternOffset = 1 + prop.exponentWidth;
    const exponentBitPattern = new Uint8Array(rawBitPattern, 1, prop.exponentWidth);
    const fractionBitPattern = new Uint8Array(rawBitPattern, fractionBitPatternOffset, numBits - 1 - prop.exponentWidth);

    const exponentZeroOffset = (1 << (prop.exponentWidth - 1)) - 1;
    const exponentSum = sum(exponentBitPattern);
    const fractionSum = sum(fractionBitPattern);
    const implicitLeadingFractionBit = exponentBitPattern.includes(1) ? 1 : 0;
    
    const sgn = Math.pow(-1, fullBitPattern[0]);
    const e = exponentSum === 0 ? 1 : [...Array(prop.exponentWidth).keys()].reduce((acc, i) => {
        return acc + Math.pow(2, i) * exponentBitPattern[exponentBitPattern.length - i - 1];
    }, 0);
    const f = [...Array(numBits - 1 - prop.exponentWidth).keys()].reduce((acc, i) => {
        return acc + Math.pow(2, -(i + 1)) * fractionBitPattern[i];
    }, implicitLeadingFractionBit);
    
    let number = undefined;

    if (exponentSum === 0) {
        if (fractionSum === 0) {
            number = sgn === -1 ? '-0.0' : '0.0';
        }
    } else if (exponentSum === exponentBitPattern.length) {
        if (fractionSum === 0) {
            number = sgn * Infinity;
        } else {
            number = sgn * NaN;
        }
    }

    if (number === undefined) {
        number = sgn * Math.pow(2, e - exponentZeroOffset) * f;
    }

    document.getElementById('number-preview').value = `${number}`;
    const formulaDiv = document.getElementById('number-formula');
    formulaDiv.textContent = `(-1)^${fullBitPattern[0]} * 2^(${e} - ${exponentZeroOffset}) * ${f}`;
}



const setNumberFromString = string => {
    const bytes = _double2IEEE(parseFloat(string));
    let idx = 0;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const state = (bytes[i] & (1 << j)) !== 0 ? 1 : 0;
            fullBitPattern[fullBitPattern.length - 1 - idx] = state;
            idx += 1;
        }
    }
    setSelectedFormat(FORMAT.binary64);
    settings.setBitPattern(fullBitPattern);
    setupBitsTable();
    reloadNumber();
}



const setupBitsTable = () => {
    const numBytes = NumberProperties[currentFormat].byteCount;
    const numBits = numBytes * 8;
    
    const bitsTable = document.getElementById('bits-table');
    removeAllChildren(bitsTable);
    
    let byteElem;
    for (let i = 0; i < numBits; i++) {
        if (i % 8 == 0) {
            byteElem = document.createElement('div');
            byteElem.classList.add('byte');
            bitsTable.appendChild(byteElem);
        }
        const bitElem = document.createElement('div');
        bitElem.classList.add('monospaced', 'bit');
        bitElem.textContent = `${fullBitPattern[i]}`;
        bitElem.addEventListener('click', reloadNumber);
        bitElem.title = `bit #${numBits - 1 - i}`;
        bitElem.setAttribute('lk_bit_index', numBits - 1 - i);
        byteElem.appendChild(bitElem);
        if (i == 0) {
            bitElem.classList.add('bit-style-signbit');
            bitElem.title += ' (sign bit)';
        } else if (i < NumberProperties[currentFormat].exponentWidth + 1) {
            bitElem.classList.add('bit-style-exponent');
            bitElem.title += ' (exponent)';
        } else {
            bitElem.classList.add('bit-style-significand');
            bitElem.title += ' (fraction)';
        }
    }
}

const main = () => {
    for (const elem of document.getElementsByClassName('format-option')) {
        elem.addEventListener('click', setSelectedFormat);
    }

    document.getElementById('number-preview').addEventListener('keyup', event => {
        if (event.key === 'Enter') {
            setNumberFromString(event.target.value);
        }
    })

    currentFormat = settings.getFormat() || FORMAT.binary64;
    document.getElementsByClassName('format-option')[_formatId[currentFormat]].classList.add('format-selected');
    setSelectedFormat(currentFormat);

    if (!settings.loadBitPattern()) {
        setNumberFromString('-12.75');
    } else {
        setupBitsTable();
        reloadNumber();
    }
};


document.addEventListener('DOMContentLoaded', main);