const pCss = `color: #9fa5a9; line-height: 20px!important; text-align: center; font-family: Graphik,sans-serif;`
const inputCss = `padding-left: 40px; cursor: pointer; font-size: 13px;font-weight: 700;color: #fff;background-color: #5cb85c;border-color: #4cae4c;text-align: center;vertical-align: middle;touch-action: manipulation;padding: 10px 20px;border-radius: 3px;line-height: 1.42857; border: 1px solid transparent;`

module.exports.getInput = () =>
    `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Please provide authorization input</title>
  </head>
  <body>
    <p style="${pCss} margin-top: 200px;"> Please copy/paste the verification code. Then click submit. </p>
    <form method="POST" action="/input" style="text-align: center; margin-top: 50px">
      <input placeholder= "your input" name="code" id="code" style="font-size: 14px;font-family: monospace,serif;color: #11181c; border-radius: 3px; border: 1px solid #ccc; padding: 10px 15px; width: 400px; height: 20px; margin: auto"/>
      <input type="submit" style="${inputCss}"/>
    </form>
  </body>
</html>`

module.exports.success = () =>
    `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Input Saved</title>
  </head>
  <body>
    <p style="${pCss} margin-top: 200px;"> Thank you! You can now return to the actor </p>
  </body>
</html>`