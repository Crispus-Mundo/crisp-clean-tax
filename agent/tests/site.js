// Fake SuccessTax (several screens inside a frame, like the real one). Test only.
module.exports = (path) => {
  const page = (body, title = 'SuccessTax') => `<html><head><title>${title}</title></head><body>${body}</body></html>`;
  if (path.includes('/return.php')) return page(`<h3>Return: Jordan A Taylor (PRACTICE) 2025</h3>
    <button onclick="top.efiled=true">E-File Return</button> <iframe id="main" name="main" src="/main/pro/summary.php" width="1000" height="800"></iframe>`, 'SuccessTax - Jordan A Taylor');
  if (path.includes('/summary.php')) return page(`<p>Return summary</p><a href="/main/pro/mode.php">Edit</a>`);
  if (path.includes('/mode.php')) return page(`<p>How do you want to enter this return?</p><a href="/main/pro/forms.php">Direct Input</a> <a href="/main/pro/interview.php">Interview</a>`);
  if (path.includes('/forms.php')) return page(`<h4>Direct Input — choose a form</h4><ul><li><a href="/main/pro/w2.php">W2</a></li><li><a href="/main/pro/1099int.php">1099INT</a></li><li><a href="/main/pro/schc.php">Schedule C</a></li></ul>
    <script>if(top.w2saved)document.body.insertAdjacentHTML('beforeend','<p>W2 #1 saved</p>')</script>`);
  if (path.includes('/w2.php')) return page(`<h4>W2 Wage and Tax Statement</h4><form onsubmit="return false"><table>
    <tr><td>Employee SSN</td><td><input name="emp_ssn"></td></tr>
    <tr><td>1 Wages, tips, other compensation</td><td><input name="wages_tips"></td></tr>
    <tr><td>2 Federal income tax withheld</td><td><input name="fobj9"></td></tr>
    <tr><td>3 Social security wages</td><td><input name="soc_sec_wages"></td></tr>
    <tr><td>15 State</td><td><select name="state1"><option></option><option>MI</option><option>OH</option></select></td></tr>
    <tr><td>Employee ZIP</td><td><input name="emp_zip"></td></tr></table>
    <button type="button" onclick="document.getElementById('sd').style.display='block'">Save</button>
    <button type="button" onclick="top.deleted=true">Delete this W2</button></form>
    <div id="sd" style="display:none;border:2px solid #333;padding:8px"><b>Michigan school district</b>
      <select name="school_district"><option></option><option value="63290">63290 Walled Lake</option><option value="63010">63010 Birmingham</option></select>
      <button type="button" onclick="top.w2saved={ssn:document.getElementsByName('emp_ssn')[0].value,box1:document.getElementsByName('wages_tips')[0].value,box2:document.getElementsByName('fobj9')[0].value,box3:document.getElementsByName('soc_sec_wages')[0].value,state:document.getElementsByName('state1')[0].value,zip:document.getElementsByName('emp_zip')[0].value,sd:document.getElementsByName('school_district')[0].value};location.href='/main/pro/forms.php'">Save district</button></div>`);
  return page('<p>Not built in the fake site</p>');
};
