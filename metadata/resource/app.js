// global variables
const errorResponse = err => {
  modal(err.status, err.statusText);
};
const mainTitle = $("title").html();
const names = [
  "Name",
  "Address",
  "Address 2",
  "City",
  "State",
  "Zip",
  "Purpose",
  "Property Owner",
  "Creation Date"
];
const wrapper1 = `
<div class="text-center">
	<button type="button" class="btn btn-dark" id="uploadCSV">Upload CSV File</button>
	<button type="button" class="btn btn-dark" id="searchData">Search</button>
</div>
`;
const wrapper2 = `
<div class="input-group mr-auto ml-auto mb-3">
	<div class="custom-file">
		<input type="file" class="custom-file-input" id="inputGroupFile02">
		<label class="custom-file-label" for="inputGroupFile02">Drag &amp; Drop or click here to browse for your file</label>
	</div>
	<div class="input-group-append" id="upload">
		<span class="input-group-text">Upload</span>
	</div>
	<div class="input-group-append" id="goBack">
    <span class="input-group-text">Go Back</span>
	</div>
</div>
<div class="text-center">
	<input type="checkbox" id="headerCheck" checked aria-label="Checkbox if header is included">
<label for="headerCheck">Check here if a header is included as the first line of the file</label>
</div>
`;
const wrapper3 = `
<div class="input-group mb-3">
	<input type="text" class="form-control" id="searchImports">
	<div class="input-group-append">
		<span class="input-group-text" id="searchDB">Search</span>
		<span class="input-group-text" id="goBack">Go Back</span>
	</div>
</div>
`;
let code;
let editable;
let end;
let errorCount = 0;
let fieldData;
let fieldDate = true;
let fieldErrors;
let fieldNames;
let fieldState = true;
let fieldZip = true;
let fileName;
let firstError;
let firstRun = true;
let fullResults;
let geocoder;
let headerCheck = true;
let infowindow;
let lat;
let long;
let map;
let mapped = false;
let markers = [];
let message;
let name = true;
let pageSwitch = false;
let row;
let rowCount = 0;
let sortASC = true;
let start;

// Modal

function modal(moId, moBody, moFooter) {
  $("body").append(`
  <div class="modal fade" id="${moId}" data-backdrop="static" data-keyboard="false" tabindex="-1" role="dialog" aria-labelledby="${moId}Label" aria-hidden="true">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="${moId}Label">${moId}</h5>
          <button type="button" class="close" id="${moId}Close1" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body" id="modalBody"></div>
        <div class="modal-footer" id="modalFooter"></div>
      </div>
    </div>
	</div>
	`);
  $(`#${moId}`).modal("show");
  $("#modalBody").html(`<h5 class="text-center">${moBody}</h5>`);
  const okButton = `<button type="button" class="btn btn-primary" id="${moId}Close2">Ok</button>`;
  if (moFooter) {
    $("#modalFooter").html(`${moFooter}${okButton}`);
  } else {
    $("#modalFooter").html(okButton);
  }
  modalDispose(moId, "Close1");
  modalDispose(moId, "Close2");
}

function modalDispose(moId, close, func) {
  $(`#${moId}${close}`).click(() => {
    $(`#${moId}`).modal("hide");
    $(`#${moId}`).on("hidden.bs.modal", () => {
      $(".modal").remove();
      $(".modal-backdrop").remove();
      if (func) func();
    });
  });
}

// fix errors

function returnToList() {
  $("#mapData").html("Return to list");
  $("#mapData").click(() => {
    errorCount = 0;
    buildTable();
  });
}

function toggleEditable(row) {
  editable = $("#csvTable");
  if (!editable[0].isContentEditable) {
    editable[0].contentEditable = "true";
    $("#editData").html("Save Edits");
    $(".border-dark").removeClass("invisible");
    if (mapped) {
      $("tbody").removeClass("latlong");
    }
    if (fieldData[0].id) {
      $("#newRecord").removeClass("invisible");
    }
  } else {
    let r = 0;
    while (r < fieldData.length) {
      r += 1;
    }
    if ($(`#row${r}Field0Name`).html() != "") {
      const newRow = {};
      for (let i = 0; i < names.length; i += 1) {
        const e = names[i];
        if (e === "Lat" || e === "Long") {
          newRow[`${e}`] = "0.0";
        } else {
          newRow[`${e}`] = $(
            `#row${r}Field${i}${e.replace(/\s+/g, "")}`
          ).html();
        }
      }
      $.ajax({
        url: `/imports/${$("#row0Field12import_id").html()}/records/`,
        type: "post",
        data: JSON.stringify(newRow),
        dataType: "json",
        contentType: "application/json",
        success: res => {
          newCSV();
          getRecords(res.id, res.import_name);
        },
        error: errorResponse
      });
    }

    updateFields(row);
    buildTable(row);
    if (mapped && errorCount > 0) {
      returnToList();
    }
  }
}

function removeEmptyField(row) {
  let i = 0;
  for (const k in fieldData[row]) {
    if (fieldData[row].hasOwnProperty(k)) {
      if (k != names[i] && fieldData[row][k] === "") {
        console.log(`${k} != ${names[i]}`);
        console.log("deleted empty field: ", k);
        delete fieldData[row][k];
      }
      if (Object.values(fieldData[row]).length < fieldNames.length) {
        console.log("fieldData is less then fieldNames");
        if (fieldData[row][`${names[i + 1]}`] != undefined) {
          fieldData[row][`${names[i + 1]}`] = fieldData[row][`${names[i + 1]}`];
        } else {
          fieldData[row][`${names[i + 1]}`] = "";
        }
      }
      i += 1;
    }
  }
}

function removeFirstErrorMessage(row) {
  $(`.modal`).on("hidden.bs.modal", () => {
    if (Object.values(fieldData[row]).length === fieldNames.length) {
      fieldErrors.shift(0);
      console.log(fieldErrors);
      errorCount -= 1;
      firstError = fieldErrors[0];
      console.log("     Errors:", errorCount);
      console.log("First Error:", firstError);
    }
  });
}

function fixRow(code, close, row) {
  $(`#${code}${close}`).click(() => {
    removeEmptyField(row);
    removeFirstErrorMessage(row);
    buildTable(row);
  });
}

function deleteRow(row) {
  fieldData.splice(row, 1);
  if (errorCount > 0) {
    errorCount -= 1;
  }
  if ($(`#row${row}Field11record_id`).html()) {
    const recordId = $(`#row${row}Field11record_id`).html();
    const importId = $(`#row${row}Field12import_id`).html();
    $.ajax({
      url: `/imports/${importId}/records/${recordId}`,
      type: "delete",
      success: res => {
        modal("Deleted", `Deleted Record.`);
      }
    });
  }
  buildTable();
  toggleEditable();
}

function fixButton(code, buttonName) {
  return `<button type="button" class="btn btn-danger" id="${code}${buttonName}">${buttonName}</button>`;
}

// parse csv file

function printRecords(msg) {
  let buttonName;
  let fix;
  if (msg) {
    console.log(msg);
    console.log(
      "       Time:",
      end - start ||
        "(Unknown; your browser does not support the Performance API)",
      "ms"
    );
    console.log("  Row count:", rowCount);
    console.log("     Errors:", errorCount);
  }
  if (fieldNames && fieldNames.length != names.length) {
    console.log("header length is wrong");
    let codeWord;
    if (fieldNames.length < names.length) {
      codeWord = "Few";
    } else {
      codeWord = "Many";
    }
    code = `Too${codeWord}Fields`;
    message = `Too ${codeWord.toLowerCase()} fields: expected ${
      names.length
    } fields but parsed ${fieldNames.length}`;
    modal(
      code,
      `${message} in "${fileName}", Row: 0. Header length errors must be corrected within file before further processing to prevent data loss.`
    );
    return;
  } else if (!headerCheck) {
    buildTable();
    return;
  }
  for (let i = 0; i < fieldNames.length; i += 1) {
    validateFieldNames(fieldNames[i]);
    if (!name) {
      console.log(fieldNames[i], " is invalid");
      buttonName = "Cancel";
      code = "invalidHeader";
      fix = fixButton(code, buttonName);
      modal(
        code,
        `${
          fieldNames[i]
        } is an invalid header name. Replace with correct header: ${names[i]}?`,
        fix
      );
      modalDispose(code, buttonName);
      $(`#${code}Close2`).click(() => {
        $(`#${code}`).on("hidden.bs.modal", () => {
          const oldKey = fieldNames[i];
          fieldNames[i] = names[i];
          const newKey = fieldNames[i];
          console.log("Field Name was: ", oldKey);
          console.log("Field Name is now: ", newKey);
          fieldData.forEach(e => {
            for (const k in e) {
              if (k === oldKey) {
                e[newKey] = e[oldKey];
                delete e[oldKey];
              } else if (k === "Address 2") {
                e.Address2 = e["Address 2"];
                delete e["Address 2"];
                e["Address 2"] = e.Address2;
                delete e.Address2;
              } else if (k === "__parsed_extra") {
                e.parsed_extra = e.__parsed_extra;
                delete e.__parsed_extra;
              }
            }
          });
          printRecords("Key updated");
        });
      });
      return;
    }
  }
  if (errorCount) {
    console.log("First error:", firstError);
    buttonName = "Fix";
    code = firstError.code;
    fix = fixButton(code, buttonName);
    message = firstError.message;
    row = firstError.row;
    modal(code, `${message} in "${fileName}", Row: ${row + 1}`, fix);
    modalDispose(code, buttonName, fixRow(code, buttonName, row));
  } else {
    buildTable();
  }
}

// track parsing time
function now() {
  return typeof window.performance !== "undefined"
    ? window.performance.now()
    : 0;
}

function errorFn(err, file) {
  end = now();
  console.log("ERROR:", err, file);
}

function completeFn(results) {
  end = now();
  fullResults = results;
  fieldNames = fullResults.meta.fields;
  fieldData = fullResults.data;
  fieldErrors = fullResults.errors;
  if (fullResults && fieldErrors) {
    if (fieldErrors) {
      errorCount = fieldErrors.length;
      firstError = fieldErrors[0];
    }
    if (fieldData && fieldData.length > 0) {
      rowCount = fieldData.length;
    }
  }
  printRecords("Parse complete");
  console.log("    Results:", fullResults);
}

// Enable application to parse file
function parseFile() {
  pageSwitch = false;

  setPage("Upload CSV File", wrapper2, "#goBack", main);

  $("#headerCheck").click(() => {
    if ($("#headerCheck").prop("checked")) {
      headerCheck = true;
      console.log("check box is checked = ", headerCheck);
    } else {
      headerCheck = false;
      console.log("check box is checked = ", headerCheck);
    }
  });

  // replace input placeholder with file name
  $("#inputGroupFile02").on("change", function() {
    fileName = $(this).val();
    fileName = fileName.substring(fileName.lastIndexOf("\\") + 1);
    if (fileName != "") {
      $(this)
        .next(".custom-file-label")
        .addClass("selected")
        .html(fileName);
      $(".csv").html("");
    } else {
      $(this)
        .next(".custom-file-label")
        .addClass("selected")
        .html("Drag & Drop or click here to browse for your file");
      $(".csv").html("");
    }
  });

  $("#upload").click(() => {
    rowCount = 0;
    errorCount = 0;
    firstError = undefined;
    if (!firstRun) {
      console.log("--------------------------------------------------");
    } else {
      firstRun = false;
    }
    if (!$("#inputGroupFile02")[0].files.length) {
      modal("noFileChosen", "Please choose at least one file to parse.");
      return;
    }
    
    // use jquery to select files
    $('#inputGroupFile02').parse({
      config: {
        // base config to use for each file
        delimiter: "",
        header: headerCheck,
        dynamicTyping: false,
        skipEmptyLines: true,
        preview: 0,
        step: undefined,
        encoding: "",
        worker: false,
        comments: false,
        complete: completeFn,
        error: errorFn,
      },
      before(file) {
        // executed before parsing each file begins;
        // what you return here controls the flow
        start = now();
        console.log('Parsing file...', file);
      },
      error(err, file) {
        // executed if an error occurs while loading the file,
        // or if before callback aborted for some reason
        console.log('ERROR:', err, file);
        firstError = firstError || err;
        errorCount++;
      },
      complete() {
        // executed after all files are complete
        end = now();
      }
    });

  });
}

function getFieldNames(fn) {
  if (headerCheck) {
    let i = 0;
    fn += `
    <th class="border border-dark invisible">Delete Record</th>
    <th scope="col" id="sortId">#</th>
    `;
    fieldNames.forEach(e => {
      validateFieldNames(e);
      if (name) {
        fn += `<th id="header${i}">${e}</th>`;
      } else {
        fn += `<th class="table-danger" id="header${i}">${e}</th>`;
      }
      i += 1;
    });
  }
  return fn;
}

function deleteButton(rowNum) {
  return `<th class="deleteRow table-danger text-center align-middle border border-dark invisible" id="deleteRow${rowNum}">X</th>
  <th scope="row">${rowNum + 1}</th>`;
}

function getFieldData(fd, row, fullAddress, addressList) {
  if (errorCount) {
    let j = 0;
    fd += deleteButton(row);
    for (const k in fieldData[row]) {
      if (fieldData[row].hasOwnProperty(k)) {
        const e = fieldData[row][k];
        validateState(e);
        validateZip(e);
        validateDate(e);
        fd += `<td id="row${row}Field${j}">${e}</td>`;
        j += 1;
      }
    }
  } else {
    let r = 0;
    fieldData.forEach(e => {
      let j = 0;
      validateState(e);
      validateZip(e);
      validateDate(e);
      ({ fd, j, fullAddress } = buildFields(fd, r, e, j, fullAddress));
      addressList.push(fullAddress);
      fullAddress = "";
      fd += `</tr>`;
      r += 1;
    });
    fd += `
          <tr class="invisible" id="newRecord">
            <th contenteditable="false">Add New Record</th>
            <th contenteditable="false" scope="row">${r + 1}</th>
            <td id="row${r}Field0Name"></td>
            <td id="row${r}Field1Address"></td>
            <td id="row${r}Field2Address2"></td>
            <td id="row${r}Field3City"></td>
            <td id="row${r}Field4State"></td>
            <td id="row${r}Field5Zip"></td>
            <td id="row${r}Field6Purpose"></td>
            <td id="row${r}Field7PropertyOwner"></td>
            <td id="row${r}Field8CreationDate"></td>
            <td id="row${r}Field9Lat"></td>
            <td id="row${r}Field10Long"></td>
            <td class="invisible" id="row${r}Field11record_id"></td>
            <td class="invisible" id="row${r}Field12import_id"></td>
          </tr>
          `;
  }
  return { fd, fullAddress };
}

function buildFields(fd, r, e, j, fullAddress) {
  fd += `<tr id ="row${r}">${deleteButton(r)}`;
  for (const k in e) {
    if (e.hasOwnProperty(k)) {
      const f = e[k];
      if (
        (f === e.State && !fieldState) ||
        (f === e.Zip && !fieldZip) ||
        (f === e["Creation Date"] && !fieldDate)
      ) {
        fd += `<td class="table-danger" id="row${r}Field${j}${k.replace(
          /\s+/g,
          ""
        )}">${f}</td>`;
      } else {
        if (k === "id" || k === "import_id") {
          j--;
        } else {
          fd += `<td id="row${r}Field${j}${k.replace(/\s+/g, "")}">${f}</td>`;
        }
        if (
          k === "Name" ||
          k === "Address" ||
          k === "City" ||
          k === "State" ||
          k === "Zip"
        ) {
          fullAddress += ` ${f}`;
        }
      }
      j += 1;
    }
  }
  if (e.id) {
    fd += `<td class="invisible" id="row${r}Field${j}record_id">${e.id}</td>
          <td class="invisible" id="row${r}Field${j + 1}import_id">${
      e.import_id
    }</td>`;
  }
  return { fd, j, fullAddress };
}

function updateFields(row) {
  if (headerCheck) {
    for (let i = 0; i < fieldNames.length; i += 1) {
      fieldNames[i] = $(`#header${i}`).html();
      validateFieldNames(fieldNames[i]);
      if (name) {
        $(`#header${i}`).removeClass("table-danger");
      } else {
        $(`#header${i}`).addClass("table-danger");
      }
    }
  }
  let j = 0;
  if (row != undefined) {
    for (const k in fieldData[row]) {
      fieldData[row][k] = $(`#row${row}Field${j}`).html();
      validateField(fieldData[row], k, row, j);
      j += 1;
    }
  } else {
    let i = 0;
    fieldData.forEach(e => {
      let j = 0;
      for (const k in e) {
        if (k != "id" && k != "import_id") {
          e[k] = $(`#row${i}Field${j}${k.replace(/\s+/g, "")}`).html();
          validateField(e, k, i, j);
          j += 1;
        }
      }
      i += 1;
    });
  }

  if (fieldData[0].id) {
    let counter = fieldData.length;
    let i = 0;
    let intervalId;
    function start() {
      if (counter === 0) {
        clearInterval(intervalId);
        $(".csv").prepend('<p class="text-center">Records Updated</p>');
      } else {
        $.ajax({
          url: `/imports/${fieldData[i].import_id}/records/${fieldData[i].id}`,
          type: "put",
          data: JSON.stringify(fieldData[i]),
          dataType: "json",
          contentType: "application/json",
          success: res => {
            counter--;
            i += 1;
          },
          error: () => {
            errorResponse;
            clearInterval(intervalId);
          }
        });
      }
    }
    intervalId = setInterval(start, 100);
  }

  console.log("    Updated Data: ", fieldData);
}

function newCSV() {
  errorCount = 0;
  fullResults = {};
  fieldNames = {};
  fieldData = {};
  fieldErrors = {};
  fileName = undefined;
  headerCheck = true;
  mapped = false;
  markers = [];
  $("#map").html("");
  $("#map").removeAttr("style");
  $(".csv").removeClass("p-5");
  $("#jumboHeader").addClass("mb-5");
  geoClear();
  parseFile();
}

// build table

function buildTable(row) {
  const addressList = [];
  let fn = "";
  let fd = "";
  let fullAddress = "";

  function sorter(headerId, field) {
    let sortOrder;
    $(`#${headerId}`).click(() => {
      const id = $("#row0Field12import_id").html();
      const importName = $("#jumboHeader").html();
      if (sortASC) {
        sortOrder = "ASC";
        sortASC = false;
      } else {
        sortOrder = "DESC";
        sortASC = true;
      }
      getRecords(id, importName, `/sort${sortOrder}`, `"${field}"`);
    });
  }

  $(".csv").addClass("p-5");

  fn = getFieldNames(fn);

  ({ fd, fullAddress } = getFieldData(fd, row, fullAddress, addressList));

  // force correction of header names
  if (row === "header") {
    fd = "";
  }

  $("#jumboHeader").removeClass("mb-5");
  $("#jumboHeader").html(fileName);
  $("title").html(fileName);
  $(".wrapper").html("");

  $(".csv").html(`
                    <div class="btn-group d-flex justify-content-center mb-3" role="group" aria-label="button group">
                      <button type="button" class="btn btn-secondary" id="editData">Edit Data</button>
                      <button type="button" class="btn btn-secondary invisible" id="saveRecords">Save Records</button>
                      <button type="button" class="btn btn-secondary" id="mapData">Map Imported Data</button>
                      <button type="button" class="btn btn-secondary" id="repairNext">Repair Next Error</button>
                      <button type="button" class="btn btn-secondary" id="search">New Search</button>
                      <button type="button" class="btn btn-secondary" id="newCSV">Import New CSV File</button>
                    </div>
                    <div class="card">
                      <div class="card-body">
                        <table id="csvTable" class="table table-bordered">
                          <thead>
                            <tr class="headerRow">
                              ${fn}
                            </tr>
                          </thead>
                          <tbody>
                            ${fd}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  `);

  if ($("#row0Field12import_id").html() !== undefined) {
    // add pointer cursor
    $(".headerRow").addClass("sorterRow");

    // sort by id
    sorter("sortId", "id");

    // sort by field header
    for (let i = 0; i < names.length; i += 1) {
      const e = names[i];
      const headerId = `header${i}`;
      sorter(headerId, e);
    }
  }

  // show pointer cursor after mapping to indicate
  // row is clickable for geocoding
  if (mapped) {
    $("tbody").addClass("latlong");
    $("#saveRecords").removeClass("invisible");
    $("title").html(`${$("#jumboHeader").html()} Mapped`);
  }

  // add click handlers to delete buttons and rows
  for (let i = 0; i < fieldData.length; i += 1) {
    if (mapped) {
      $(`#row${i}`).click(() => {
        geocodeLatLng(i);
      });
    }
    $(`#deleteRow${i}`).click(() => {
      deleteRow(i);
    });
  }

  // show or hide repair next or map data buttons
  if (firstError === undefined) {
    $("#repairNext").addClass("invisible");
  } else {
    $("#mapData").addClass("invisible");
  }

  // add click handlers to button row
  $("#editData").click(() => {
    toggleEditable(row);
  });
  $("#saveRecords").click(() => {
    saveRecords();
  });
  $("#mapData").click(() => {
    if (!mapped) {
      initialize();
    }
    geoIterate(addressList);
  });
  $("#repairNext").click(() => {
    updateFields(row);
    printRecords();
  });
  $("#search").click(() => {
    newCSV();
    pageSwitch = true;
    main();
  });
  $("#newCSV").click(newCSV);
}

// validate

function validateFieldNames(fieldName) {
  for (let i = 0; i < names.length; i += 1) {
    if (fieldName === names[i]) {
      name = true;
      return;
    }
    name = false;
  }
}

function validateState(row) {
  const states = [
    "AL",
    "AK",
    "AS",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "DC",
    "FM",
    "FL",
    "GA",
    "GU",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MH",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MP",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "MP",
    "OH",
    "OK",
    "OR",
    "PW",
    "PA",
    "PR",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VI",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY"
  ];
  if (row.State) {
    for (let i = 0; i < states.length; i += 1) {
      if (row.State === states[i]) {
        fieldState = true;
        return;
      }
      fieldState = false;
    }
  }
}

function validateZip(row) {
  fieldZip = true;
  const digits = "0123456789";
  if (row.Zip) {
    if (row.Zip.length != 5) {
      fieldZip = false;
    }
    for (let i = 0; i < row.Zip.length; i += 1) {
      const zipDigit = `${row.Zip.substring(i, i + 1)}`;
      if (digits.indexOf(zipDigit) === "-1") {
        fieldZip = false;
      }
    }
  }
}

function validateDate(row) {
  fieldDate = true;
  const regEx = /^\d{4}-\d{2}-\d{2}$/;

  if (row["Creation Date"]) {
    if (!row["Creation Date"].match(regEx)) {
      // Invalid format
      fieldDate = false;
    }

    const d = new Date(row["Creation Date"]);

    if (!d.getTime() && d.getTime() !== 0 && fieldDate) {
      // Invalid date
      fieldDate = false;
      console.log(`${row["Creation Date"]} is an invalid date`);
    }
  }
}

function validateField(e, k, i, j) {
  validateState(e);
  validateZip(e);
  validateDate(e);
  if (
    (e[k] === e.State && !fieldState) ||
    (e[k] === e.Zip && !fieldZip) ||
    (e[k] === e["Creation Date"] && !fieldDate)
  ) {
    $(`#row${i}Field${j}`).addClass("table-danger");
  } else {
    $(`#row${i}Field${j}`).removeClass("table-danger");
  }
}

// geocode

function ShowAllMarkers(showAllControlDiv, map) {
  const controlUI = document.createElement("div");
  controlUI.style.backgroundColor = "#fff";
  controlUI.style.border = "2px solid #fff";
  controlUI.style.borderRadius = "3px";
  controlUI.style.boxShadow = "0 2px 6px rgba(0,0,0,.3)";
  controlUI.style.cursor = "pointer";
  controlUI.style.marginBottom = "22px";
  controlUI.style.textAlign = "center";
  controlUI.title = "Click to show all markers";
  showAllControlDiv.appendChild(controlUI);

  const controlText = document.createElement("div");
  controlText.style.color = "rgb(25,25,25)";
  controlText.style.fontFamily = "Roboto,Arial,sans-serif";
  controlText.style.fontSize = "16px";
  controlText.style.lineHeight = "38px";
  controlText.style.paddingLeft = "5px";
  controlText.style.paddingRight = "5px";
  controlText.innerHTML = "Show All Markers";
  controlUI.appendChild(controlText);

  controlUI.addEventListener("click", setMarkerBounds);
}

function initialize() {
  $("#map").css({
    width: "75%",
    height: "400px",
    margin: "auto"
  });
  geocoder = new google.maps.Geocoder();
  infowindow = new google.maps.InfoWindow({
    maxWidth: 400
  });
  const latlng = new google.maps.LatLng(38.92861, -98.579458);
  const mapOptions = {
    zoom: 4,
    center: latlng
  };
  map = new google.maps.Map(document.getElementById("map"), mapOptions);
  mapped = true;

  const showAllControlDiv = document.createElement("div");
  const showAllMarkers = new ShowAllMarkers(showAllControlDiv, map);

  showAllControlDiv.index = 1;
  map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(
    showAllControlDiv
  );
}

function codeAddress(fullAddress, fieldData, intervalId, r) {
  geocoder.geocode(
    {
      address: fullAddress
    },
    (results, status) => {
      if (status === "OK") {
        lat = results[0].geometry.location.lat();
        long = results[0].geometry.location.lng();
        for (const k in fieldData) {
          if (fieldData.hasOwnProperty(k)) {
            const f = fieldData[k];
            const addressComponents = results[0].address_components;
            switch (f) {
              case fieldData.Address:
                let address = "";
                for (let i = 0; i < addressComponents.length; i += 1) {
                  const e = addressComponents[i];
                  if (e.types[0] === "street_number") {
                    address += e.short_name;
                  } else if (e.types[0] === "route") {
                    address += ` ${e.short_name}`;
                    if (fieldData.Address != address) {
                      fieldData.Address = address;
                    }
                    break;
                  }
                }
                buildTable();
                break;
              case fieldData.City:
                for (let i = 0; i < addressComponents.length; i += 1) {
                  const e = addressComponents[i];
                  if (
                    e.types[0] === "locality" &&
                    fieldData.City != e.long_name
                  ) {
                    fieldData.City = e.long_name;
                  }
                }
                buildTable();
                break;
              case fieldData.State:
                for (let i = 0; i < addressComponents.length; i += 1) {
                  const e = addressComponents[i];
                  if (
                    e.types[0] === "administrative_area_level_1" &&
                    fieldData.State != e.short_name
                  ) {
                    fieldData.State = e.short_name;
                  }
                }
                buildTable();
                break;
              case fieldData.Zip:
                for (let i = 0; i < addressComponents.length; i += 1) {
                  const e = addressComponents[i];
                  if (
                    e.types[0] === "postal_code" &&
                    fieldData.Zip != e.short_name
                  ) {
                    fieldData.Zip = e.short_name;
                  }
                }
                buildTable();
                break;
              default:
                buildTable();
            }
          }
        }
        fieldData.Lat = lat;
        fieldData.Long = long;
        map.setCenter(results[0].geometry.location);
        const marker = new google.maps.Marker({
          map,
          position: results[0].geometry.location
        });
        markers.push(marker);
        marker.addListener("click", () => {
          map.setZoom(15);
          map.setCenter(results[0].geometry.location);
          showInfoWin(r, marker);
        });
      } else {
        fixGeocodeFail(intervalId, status, fullAddress, r);
      }
    }
  );
}

function fixGeocodeFail(intervalId, status, fullAddress, r) {
  clearInterval(intervalId);
  const buttonName = "Fix";
  const fix = fixButton(status, buttonName);
  modal(
    status,
    `Geocode was not successful for the following reason: ${status}: ${fullAddress}`,
    fix
  );
  modalDispose(status, buttonName, () => {
    errorCount = 1;
    buildTable(r);
    returnToList();
  });
}

function geocodeLatLng(r) {
  const input0 = $(`#row${r}Field9Lat`).html();
  const input1 = $(`#row${r}Field10Long`).html();
  const latlng = {
    lat: parseFloat(input0),
    lng: parseFloat(input1)
  };
  geocoder.geocode({ location: latlng }, (results, status) => {
    if (status === "OK") {
      if (results[0]) {
        map.setZoom(15);
        const marker = new google.maps.Marker({
          position: latlng,
          map
        });
        markers.push(marker);
        marker.addListener("click", () => {
          map.setZoom(15);
          showInfoWin(r, marker);
          map.setCenter(results[0].geometry.location);
        });
        showInfoWin(r, marker);
        map.setCenter(results[0].geometry.location);
      } else {
        modal("noResults", "No results found");
      }
    } else {
      modal(status, `Geocoder failed due to: ${status}`);
    }
  });
}

function showInfoWin(r, marker) {
  infowindow.setContent(`
  <div id="content">
    <div id="siteNotice"></div>
    <h5 id="firstHeading" class="firstHeading">${$(
      `#row${r}Field0Name`
    ).html()}</h5>
    <div id="bodyContent">
      ${$(`#row${r}Field1Address`).html()} ${$(
    `#row${r}Field2Address2`
  ).html()} ${$(`#row${r}Field3City`).html()} ${$(
    `#row${r}Field4State`
  ).html()} ${$(`#row${r}Field5Zip`).html()}
      <br>
      <b style="font-weight: 900">Purpose:</b> ${$(
        `#row${r}Field6Purpose`
      ).html()} <b style="font-weight: 900">Property Owner:</b> ${$(
    `#row${r}Field7PropertyOwner`
  ).html()} <b style="font-weight: 900">Creation Date:</b> ${$(
    `#row${r}Field8CreationDate`
  ).html()}
    </div>
  </div>
  `);
  infowindow.open(map, marker);
}

function setMarkerBounds() {
  const bounds = new google.maps.LatLngBounds();
  for (let i = 0; i < markers.length; i += 1) {
    const e = markers[i];
    bounds.extend(e.getPosition());
  }
  map.setCenter(bounds.getCenter());
  google.maps.event.addListenerOnce(map, "zoom_changed", () => {
    if (map.getZoom() > 15) {
      map.setZoom(15);
    }
  });
  map.fitBounds(bounds);
}

function showLatLong() {
  if (fieldNames && names.length < 11 && fieldNames.length < 11) {
    names.push("Lat", "Long");
    fieldNames.push("Lat", "Long");
  }
}

function geoIterate(fullAddress) {
  let counter = fullAddress.length;
  let i = 0;
  let intervalId;
  function start() {
    if (counter === 0) {
      clearInterval(intervalId);
      setMarkerBounds();
    } else if (markers.length < fieldData.length) {
      codeAddress(fullAddress[i], fieldData[i], intervalId, i);
    }
    counter -= 1;
    i += 1;
    buildTable();
  }
  intervalId = setInterval(start, 500);
  showLatLong();
}

function geoClear() {
  while (names.length > 9) {
    names.pop();
  }
}

// main

function setHeader(header, wrapper) {
  $("title").html(header);
  $("#jumboHeader").html(header);
  $(".wrapper").html(wrapper);
  $("#map").html("");
  $(".csv").html("");
}

function setPage(header, wrapper, elId0, func0, elId1, func1, elId2, func2) {
  setHeader(header, wrapper);
  $(elId0).click(func0);
  $(elId1).click(func1);
  $(elId2).click(params => {
    func2(params);
  });
}

function getRecords(id, importName, sort, field) {
  const term = `?term=${field}`;
  $.ajax({
    url: `/imports/${id}${sort || ""}/records/${term || ""}`,
    type: "get",
    success: res => {
      if (res.length > 0) {
        setHeader(importName);
        const namesLength = Object.keys(res[0]).length - 2;
        if (names.length < namesLength) {
          names.push("Lat", "Long");
        }
        fieldNames = names;
        fieldData = res;
        printRecords();
      } else {
        modal("404", "Not Found");
      }
    },
    error: errorResponse
  });
}

function postData(importName) {
  const data = { import_name: importName };

  function saveResponse(i) {
    return res2 => {
      if (i === fieldData.length - 1) {
        modal("Success", `Saved ${res2.import_name}`);
      }
    };
  }

  $.ajax({
    url: "/imports/",
    type: "post",
    data: JSON.stringify(data),
    dataType: "json",
    contentType: "application/json",
    success: res => {
      for (let i = 0; i < fieldData.length; i += 1) {
        const e = fieldData[i];
        $.ajax({
          url: `/imports/${res.id}/records`,
          type: "post",
          data: JSON.stringify(e),
          dataType: "json",
          contentType: "application/json",
          success: saveResponse(i),
          error: errorResponse
        });
      }
    },
    error: errorResponse
  });
}

function searchImports(searchString) {
  $.ajax({
    url: `/imports/search?term=${$(searchString).val()}`,
    type: "get",
    success: res => {
      $(".csv").html(
        '<div id="import-list" class="d-flex justify-content-center mb-3" role="group" aria-label="button group"></div>'
      );
      res.forEach(e => {
        $("#import-list").append(
          `<button type="button" class="btn btn-dark m-1" id="get-records-${
            e.id
          }">${e.import_name}</button>`
        );
        $(`#get-records-${e.id}`).click(() => {
          getRecords(e.id, e.import_name);
        });
      });
    },
    error: errorResponse
  });
}

function main() {
  if (!pageSwitch) {
    pageSwitch = true;
    setPage(
      "Upload or Search",
      wrapper1,
      "#uploadCSV",
      parseFile,
      "#searchData",
      main
    );
    $("title").html(mainTitle);
  } else {
    pageSwitch = false;
    setPage(
      "Search By Import Name",
      wrapper3,
      "#goBack",
      main,
      "#searchDB",
      () => {
        searchImports("#searchImports");
      }
    );
  }
}

function saveRecords() {
  code = "Save";
  const button = "Cancel";
  const cancel = `<button type="button" class="btn btn-danger" id="${code}${button}">${button}</button>`;
  modal(code, "Name this imported data", cancel);
  $("#modalBody").append(
    `<input class="form-control" id="saveImportName" type="text" placeholder="Import Name" value="${fileName ||
      $("#jumboHeader").html()}">`
  );
  const saveName = document.getElementById("saveImportName");
  let importName = saveName.value;
  function getSaveName() {
    importName = saveName.value;
  }
  saveName.onchange = getSaveName;
  $(`#${code}Close2`).html(code);
  modalDispose(code, button);
  modalDispose(code, "Close2", () => {
    postData(importName);
  });
}

main();
