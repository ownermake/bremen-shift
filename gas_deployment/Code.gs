function doGet(e) {
  // If ?action=get, return JSON data
  if (e.parameter.action === 'get') {
    return getData(e);
  }
  
  // Otherwise serve the HTML
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Bremen シフト管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  // Handle data upload
  try {
    const data = JSON.parse(e.postData.contents);
    saveData(data);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Data saved' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===================================
// Backend Storage Logic (PropertiesService)
// ===================================
// Data is stored in ScriptProperties.
// For larger data, Spreadsheet is recommended, but PropertiesService is easiest for small usage.
// Note: PropertiesService has size limits (9KB per value). If data grows, we might need to chunk or use Drive/Sheet.
// For now, assuming reasonable size for shift data.

function saveData(data) {
  const props = PropertiesService.getScriptProperties();
  // Store shifts and users separately or together. 
  // Warning: If JSON is > 9KB, this will fail.
  // Let's try to store users and shifts separately to maximize space.
  
  if (data.users) props.setProperty('users', JSON.stringify(data.users));
  // Shifts might be large. Let's look into chunking if needed, but for simple start:
  if (data.shifts) props.setProperty('shifts', JSON.stringify(data.shifts));
  if (data.lastUpdated) props.setProperty('lastUpdated', String(data.lastUpdated));
}

function getData(e) {
  const props = PropertiesService.getScriptProperties();
  const usersJson = props.getProperty('users') || '[]';
  const shiftsJson = props.getProperty('shifts') || '[]';
  const lastUpdated = props.getProperty('lastUpdated') || '0';
  
  const data = {
    users: JSON.parse(usersJson),
    shifts: JSON.parse(shiftsJson),
    lastUpdated: Number(lastUpdated)
  };
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}
