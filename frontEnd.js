function showInput(input) {
    document.getElementById("imageFileSubmit").disabled = true;
    if (input.files && input.files[0]) {
        var reader = new FileReader();

        reader.onload = function (e) {
            $('#license-plate-image')
                .attr('src', e.target.result)
        };

        reader.readAsDataURL(input.files[0]);
        document.getElementById("license-plate-image").style.visibility="visible";
    }
}

var canvasImgBlob;
async function findPlate() {
    // Localize the License Plate
    const model = await tf.automl.loadObjectDetection('model/model.json');
    const img = document.getElementById('license-plate-image');
    const options = {
        score: 0.5,
        iou: 0.5,
        topk: 20
    };
        
    const predictions = await model.detect(img, options);

    var img3 = document.getElementById('license-plate-image');
    var width = img3.clientWidth;
    var height = img3.clientHeight;
    var c = document.getElementById("canvas");
    var ctx = c.getContext("2d");
    ctx.canvas.width = width;
    ctx.canvas.height = height;

    if(!!predictions && !!predictions[0] ) {
        var left = predictions[0].box.left - 15;
        var top = predictions[0].box.top - 15;
        var width = predictions[0].box.width + 35;
        var height = predictions[0].box.height + 35;

        ctx.drawImage(img3, left, top, width, height, left, top, width, height);
    }
    
    const canvasImg = document.getElementById('canvas').toDataURL('image/png')
    document.getElementById('canvasImg').src = canvasImg;

    canvasImgBlob = await (await fetch(canvasImg)).blob();

    document.getElementById("imageFileSubmit").disabled = false;
}

async function firebasePOST() {
    console.log("in firebasePOST")
    if(canvasImgBlob != null) {
        fetch('/firebaseUpload', {
                method: 'POST',
                body: canvasImgBlob,
                headers: {'Content-Type': 'image/png'},
            })
            .catch(error => {
                console.error('Error:', error);
            });
    } else {
        alert("Image is null");
    }
}

function fetchOCR() {
    const button = document.getElementById('OCRButton');
    button.disabled = true;
    alert("OCR Begun");
    fetch('/OCRScan')
        .then(response => {response.text(); button.disabled = true;})
        .then(data => console.log(data))
        .catch(error => console.error(error));
}

function resetSite() {
    const button = document.getElementById('resetButton');
    button.disabled = true;
    fetch('/resetSite')
        .then(response => {response.text(); button.disabled = false;})
        .catch(error => console.error(error));
}

var previousSubmissions;
const itemList = document.getElementById('item-list');
const dropdownButton = document.querySelector('.dropdown-button');
const dropdownContent = document.querySelector('.dropdown-content');

async function seeSubmissions() {
    itemList.innerHTML = "";
    await fetch('/seeSubmissions')
        .then(response => response.json())
        .then(data => previousSubmissions = data)
        .catch(error => console.error(error));

        // Populate the dropdown with previousSubmissions
        console.log(previousSubmissions)
        previousSubmissions.forEach(item => {
            const listItem = document.createElement('li');
            listItem.textContent = item;
            itemList.appendChild(listItem);
        });

        
}

// Show/hide the dropdown on button click
dropdownButton.addEventListener('click', () => {
    dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
});