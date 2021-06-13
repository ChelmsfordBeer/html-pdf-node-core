/* jshint esversion:8 */
const Bluebird = require('bluebird');
const hb = require('handlebars');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');

// module.exports
async function generatePdf({
  file,
  options,
  callback,
  custom = {
    logging: false, // to have extra logs while working, debugging issues
    logContent: false, // to Log content of file, as it can be long or complex
    singlePage: false,
    heightScaling: false, // percentage as .99 to make height a tad smaller, used for fine tuning
    minimumHeight: false, // num in px to make smaller than minimumHeight pages, be this minimum height
    selector: false, // String,'body > div.class' ,Selector to wait for in case we need something to be visible before printing
    viewport: false, // object:  ex: { width: 1920, height: 1080 }
    customPromise: false // object, ex: { waitUntil: "load"|"domcontentloaded"|"networkidle0"|"networkidle2"|Array }
  }
}) {

  // we are using headless mode
  // let args = [
  //   '--no-sandbox',
  //   '--disable-setuid-sandbox',
  // ];
  // if(options.args) { // * Keeping but is not in use
  //   args = options.args;
  //   delete options.args;
  // }
  const {
    logging,
    logContent,
    singlePage,
    heightScaling, // percentage as .99 to make height a tad smaller, used for fine tuning
    minimumHeight,
    selector, // Selector to wait for in case we need something to be visible before printing
    viewport,
    // customPromise
  } = custom; // deconstruct these for ease of reading

  if (logging) {
    console.log(`Logging: ${logging}`);
    console.log(`Custom: `, custom);
    console.log(`Callback: `, callback);
    console.log(`Options: `, options);
    console.log(`Selector: `, selector);
    console.log(`Viewport: `, viewport);
    console.log(`HeighScaling: `, heightScaling);
    if (logContent) {
      console.log(`File: `, file);
    }
  }

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();

  if (file.content) {

    if (logging && logContent) {
      console.log(`Compiling the template with handlebars`);
      console.log(`Logging: received file: ${file.content}`);
    }
    // we have compile our code with handlebars
    // const template = hb.compile(file.content, {
    //   strict: true
    // });
    // const result = template(file.content);
    const html = file.content;

    if (logging) {
      console.log(`Before setContent await`);
    }
    // We set the page content as the generated html by handlebars
    await page.setContent(html);
    if (logging) {
      console.log(`After setContent await`);
    }
    // await page.waitForNavigation() // this timed out
    if (viewport) {
      if (logging) {
        console.log(`Before setViewport`);
      }
      await page.setViewport(viewport);
      if (logging) {
        console.log(`After setViewport`);
      }
    }

    if (selector) {
      if (logging) {
        console.log(`Before selector await`);
      }
      await page.waitForSelector(selector);
      if (logging) {
        console.log(`After selector await`);
      }
    }

    if (logging) {
      if (logContent) {
        console.log(`Logging: resulting html: ${html}`);
      }
      let scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      console.log(`Logging: resulting offsetHeight outside SinglePage option: ${scrollHeight}`);
    }
    // Get the "viewport" of the page, as reported by the page.
    if (singlePage === true) {

      let finalHeight = await page.evaluate(() => document.documentElement.scrollHeight);

      if (heightScaling) {
        // if heightScaling exists, multiply it by height, otherwise keep final height
        console.log(`Inside heightScaling option`);
        finalHeight = finalHeight * heightScaling;
      }

      if (logging) {
        console.log(`Inside SinglePage option`);
        console.log(`Logging: temp height: ${finalHeight}`);
      }

      if (minimumHeight !== false && (finalHeight < minimumHeight)) {
        console.log(`Inside minimumHeight option`);
        // if minimum is bigger than calculated
        finalHeight = minimumHeight;
        // all other > < cases are irrelevant
      }

      options.height = `${ finalHeight }px`;

      if (options.format !== undefined) {
        options.format = undefined;
      }

    }

  } else {
    if (logging) {
      console.log(`Logging: received url: ${file.url}`);
    }
    await page.goto(file.url, {
      waitUntil: 'networkidle0', // wait for page to load completely
    });
  }

  if (logging) {
    console.log(`Logging: options before promise: `, options);
  }

  return Bluebird.props(page.pdf(options))
    // deepcode ignore PromiseNotCaughtNode
    .then(async function (data) {
      await browser.close();

      return Buffer.from(Object.values(data));
    }).asCallback(callback);
}

async function generatePdfs({ // needs to be updated
  files,
  options,
  callback,
  custom = {
    logging: false, // to have extra logs while working, debugging issues
    customHeightDivisor: false, // 75 is default when singlePage is on, but can be customized to fit needs
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

  if (custom.logging) {
    console.log(`Custom.logging: ${custom.logging}`);
    console.log(`Custom: `, custom);
    console.log(`Callback: `, callback);
    console.log(`Options: `, options);
    console.log(`File: `, file);
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
  for (let file of files) {
    if (file.content) {

      if (custom.logging) {
        console.log(`Compiling the template with no handlebars`);
        console.log(`Logging: received content: ${file.content}`);
      }
      // we have compile our code with handlebars
      const template = hb.compile(file.content, {
        strict: true
      });
      const result = template(file.content);
      const html = result;

      if (custom.logging) {
        console.log(`Logging: resulting html: ${html}`);
      }
      // We set the page content as the generated html by handlebars
      await page.setContent(html);
    } else {
      if (custom.logging) {
        console.log(`Compiling the template with no handlebars`);
        console.log(`Logging: received url: ${file.url}`);
      }
      await page.goto(file.url, {
        waitUntil: 'networkidle0', // wait for page to load completely
      });
    }
    let pdfObj = JSON.parse(JSON.stringify(file));
    delete pdfObj.content;
    pdfObj.buffer = Buffer.from(Object.values(await page.pdf(options)));
    pdfs.push(pdfObj);
  }
  return Bluebird.resolve(pdfs)
    // deepcode ignore PromiseNotCaughtNode
    .then(async function (data) {
      await browser.close();
      return data;
    }).asCallback(callback);
}

module.exports.generatePdf = generatePdf;
module.exports.generatePdfs = generatePdfs;