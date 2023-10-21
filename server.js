const PATH = "[REDACTED]/nginx-1.22.1/html/";
//Imports
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const express = require('express');
const webdriver = require('selenium-webdriver');
const {until} = require('selenium-webdriver');
const vision = require('@google-cloud/vision');
const fs = require('fs');
const bodyParser = require('body-parser');
const multer = require('multer');
var storageMulter = multer.memoryStorage()
// multer.diskStorage({
//     destination: function (req, file, cb) {
//       cb(null, 'uploads/')
//     },
//     filename: function (req, file, cb) {
//       cb(null, Date.now() + '');//.png') //Appending .jpg
//     }
// })
const upload = multer({ storage: storageMulter });
const app = express();
app.use(express.urlencoded( { extended: true }));

var lastImgDate; //global var used to get img name (which is the Date.now()) across from /firebaseUpload POST to OCRScan()
var seleniumDriver;

var inputedLicensePlates = new Array();

async function OCRScan(imgName) {console.log("OCRScan started");
    //sets up the OCR
    const clientOptions = { apiEndpoint: '[REDACTED].com' };
    const client = new vision.ImageAnnotatorClient(clientOptions);


    // Performs text detection on the image file
    const [result] = await client.textDetection(`gs://[REDACTED].com/${imgName}`);
    const labels = result.textAnnotations;
    console.log('Text:');


    var license_number = null;
    labels.forEach(function (a, b) {
        if (b == 0) {
            license_number = a.description;
        }
    });

    //prepares client html text from license plate spotted somehow
    var html = "";
    if (license_number == null) {
        license_number = "None Detected";
        html += license_number;
        console.log("no plate detected");
    } else {
        license_number = license_number.split(/\n|\r|\t/g);
        inputedLicensePlates.push(license_number);
        for (var i = 0; i < license_number.length; i++) {
            console.log(license_number[i]);
            if (/\w{2,5}\s{1,2}\w{2,5}$/gi.test(license_number[i]) && /\d+/gi.test(license_number[i])) {
                html += "<mark>" + license_number[i] + "</mark><br>";
            } else {
                html += license_number[i] + "<br>";
            }
        }
    }

    //puts the text into the html page
    var data = fs.readFileSync(PATH + 'plateScanner.html', 'utf-8');
    var newValue = data.replace(/class="license">.*?<.h3>/gi, 'class="license">' + html + '</h3>');
    fs.writeFileSync(PATH + 'plateScanner.html', newValue, 'utf-8');
    console.log('readFileSync complete');
}



//FireBase
const firebaseConfig = { //firebase told me to copy paste this
    //[REDACTED]
};
const firebaseApp = initializeApp(firebaseConfig);
const fireStorage = getStorage(firebaseApp);
const storageRef = ref(fireStorage);

//called by /firebaseUpload post request
async function firebaseUpload(ref, file) {
    uploadBytes(ref, file).then((snapshot) => {
        console.log('File uploaded');
    });
}




async function loadBrowser() {
    // Set up Selenium WebDriver
    seleniumDriver = new webdriver.Builder()
        .forBrowser('chrome')
        //.setChromeOptions(new chrome.Options().headless())
        .build();
}

async function loadPage() {
    await seleniumDriver.get('https://www.vehiclehistory.com/license-plate-search');
}

async function getVINfromPlateAndState(plate, stateLetters) {

    const element = await seleniumDriver.findElement(webdriver.By.xpath('//*[@id="input-1"]'));
    await element.sendKeys(plate);
    
    const dropdownElement = await seleniumDriver.findElement(webdriver.By.xpath('//*[@id="__layout"]/div/div[1]/div/div[4]/div/div[1]/div[2]/div/div/div/form/div[2]/div/div[1]/div[1]'));
    await dropdownElement.click();

    const dropdownOptionContainer = await seleniumDriver.findElement(webdriver.By.xpath('//*[@id="__layout"]/div/div[2]/div'));
    for(var i = 0; i < 2; i++) {
        await seleniumDriver.executeScript('arguments[0].scrollTop = arguments[0].scrollHeight', dropdownOptionContainer);
        await sleep(200);
    }
    
    const dropdownOption = await seleniumDriver.wait(until.elementLocated(webdriver.By.xpath(`//*[@id="list-2-${stateLetters}"]`)), 2000);
    dropdownOption.click();

    const submitButton = await seleniumDriver.findElement(webdriver.By.xpath('//*[@id="__layout"]/div/div[1]/div/div[4]/div/div[1]/div[2]/div/div/div/form/div[3]/button'));
    submitButton.click();
    
    const VINNumber = await seleniumDriver.wait(until.elementLocated(webdriver.By.xpath('//*[@id="__layout"]/div/div/div/div[4]/div/div[2]/div/div[2]/div[1]/div/div[1]/span[2]')), 32000);
    const VIN = await VINNumber.getText();
    console.log(VIN);
    
    const model = await seleniumDriver.wait(until.elementLocated(webdriver.By.xpath('//*[@id="__layout"]/div/div/div/div[4]/div/div[2]/div/div[2]/div[1]/div/div[2]/span[2]')), 2);
    const modelText = await model.getText();
    console.log(modelText);

    await seleniumDriver.quit();

    const output = VIN + "<br/>" + modelText;
    return output;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



app.get('/', (req, res) => {
    res.sendFile(PATH + 'plateScanner.html');
});

app.get('/frontEnd.js', (req, res) => {
    res.sendFile(PATH + 'frontEnd.js');
});

app.get('/OCRScan', async (req, res) => {
    await OCRScan(lastImgDate);
    setTimeout(() => {
        res.send('OCR Done');
    }, 1000); 
});

app.get('/resetSite', (req, res) => {
    var data = fs.readFileSync(PATH + 'plateScanner.html', 'utf-8');
    var newerValue = data.replace(/id="VIN">.*?<.h3>/gi, 'id="VIN"></h3>');
    var newestValue = newerValue.replace(/class="license">.*?<.h3>/gi, 'class="license"></h3>');
    fs.writeFileSync(PATH + 'plateScanner.html', newestValue, 'utf-8');
    console.log('reset complete');
});

app.get('/seeSubmissions', (req, res) => {
    res.json(inputedLicensePlates);
});

app.use(bodyParser.raw({type: 'image/*', limit: '10mb'})); //processes incoming blob from firebasePOST()
app.post('/firebaseUpload', async (req, res) => {
    console.log("POST recieved");
    const blob = req.body;
    lastImgDate = Date.now() + '';
    const imgRef = ref(storageRef, lastImgDate);
    await firebaseUpload(imgRef, blob);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.post('/getVIN', bodyParser.urlencoded({extended: true}), async (req, res) => {
    const plateNum = req.body.plateNum;
    const state = req.body.state;

    try {
        await loadBrowser();
        await loadPage();
        const VIN = await getVINfromPlateAndState(plateNum, state);

        var data = fs.readFileSync(PATH + 'plateScanner.html', 'utf-8');
        var newValue = data.replace(/id="VIN">.*?<.h3>/gi, 'id="VIN">' + VIN + '</h3>'); //<h3 id="VIN"></h3>
        fs.writeFileSync(PATH + 'plateScanner.html', newValue, 'utf-8');
        console.log('readFileSync complete');
        res.redirect('/');
    } catch(error) {
        console.log(error);
        //alert("get VIN unsuccessful");
    }
});

app.listen(3000); //port number for localhost:

