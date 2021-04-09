var Promise = require('bluebird');
const hb = require('handlebars')
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');

module.exports
async function generatePdf({
  file, 
  options, 
  callback, 
  custom = { 
    logging : false , // to have extra logs while working, debugging issues
    customHeightDivisor : false, // 85 is default when singlePage is on, but can be customized to fit needs
  } }) {

  // we are using headless mode
  // let args = [
  //   '--no-sandbox',
  //   '--disable-setuid-sandbox',
  // ];
  // if(options.args) { // * Keeping but is not in use
  //   args = options.args;
  //   delete options.args;
  // }

  if( custom.logging ){
    console.log(`Custom.logging: ${custom.logging}`)
    console.log(`Custom: `, custom)
    console.log(`Callback: `, callback)
    console.log(`Options: `, options)
    console.log(`File: `, file)
  }

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();

  if(file.content) {

    if ( custom.logging ) {
      console.log(`Compiling the template with handlebars`)
      console.log(`Logging: received file: ${file.content}`)
    }
    // we have compile our code with handlebars
    const template = hb.compile(file.content, { strict: true });
    const result = template(file.content);
    const html = result;

    if ( custom.logging ){
      console.log(`Logging: resulting html: ${html}`)
    }

    // We set the page content as the generated html by handlebars
    await page.setContent(html);

      // Get the "viewport" of the page, as reported by the page.
    if ( options.singlePage === true ){

      const temp = await page.evaluate(() => document.documentElement.scrollHeight)

      if ( custom.logging ) {
        console.log(`Logging: temp height: ${temp}`)
      }

      options.height = `${ temp / ( custom.customHeightDivisor !== false ? custom.customHeightDivisor : 75) }in`
      
      if ( options.format !== undefined) {
        options.format = undefined
      }

    }

  } else {
    if ( custom.logging ){
      console.log(`Logging: received url: ${file.url}`)
    }
    await page.goto(file.url, {
      waitUntil: 'networkidle0', // wait for page to load completely
    });
  }

  if ( custom.logging ) {
    console.log(`Logging: options before promise: `, options)
  }

  return Promise.props(page.pdf(options))
    .then(async function(data) {
       await browser.close();

       return Buffer.from(Object.values(data));
    }).asCallback(callback);
}

async function generatePdfs({
  files, 
  options, 
  callback, 
  custom = { 
    logging : false , // to have extra logs while working, debugging issues
    customHeightDivisor : false, // 75 is default when singlePage is on, but can be customized to fit needs
  } 
}) {
  // we are using headless mode
  // let args = [
  //   '--no-sandbox',
  //   '--disable-setuid-sandbox',
  // ];
  // if(options.args) {
  //   args = options.args;
  //   delete options.args;
  // }

  if( custom.logging ){
    console.log(`Custom.logging: ${custom.logging}`)
    console.log(`Custom: `, custom)
    console.log(`Callback: `, callback)
    console.log(`Options: `, options)
    console.log(`File: `, file)
  }
  
  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  let pdfs = [];
  const page = await browser.newPage();
  for(let file of files) {
    if(file.content) {

      if ( custom.logging ){
        console.log(`Compiling the template with no handlebars`)
        console.log(`Logging: received content: ${file.content}`)
      }
      // we have compile our code with handlebars
      const template = hb.compile(file.content, { strict: true });
      const result = template(file.content);
      const html = result;

      if ( custom.logging ){
        console.log(`Logging: resulting html: ${html}`)
      }
      // We set the page content as the generated html by handlebars
      await page.setContent(html);
    } else {
      if ( custom.logging ){
        console.log(`Compiling the template with no handlebars`)
        console.log(`Logging: received url: ${file.url}`)
      }
      await page.goto(file.url, {
        waitUntil: 'networkidle0', // wait for page to load completely
      });
    }
    let pdfObj = JSON.parse(JSON.stringify(file));
    delete pdfObj['content'];
    pdfObj['buffer'] = Buffer.from(Object.values(await page.pdf(options)));
    pdfs.push(pdfObj);
  }

  return Promise.resolve(pdfs)
    .then(async function(data) {
       await browser.close();
       return data;
    }).asCallback(callback);
}

module.exports.generatePdf = generatePdf;
module.exports.generatePdfs = generatePdfs;
