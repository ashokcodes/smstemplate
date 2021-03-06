const express = require('express')
const mongoose = require('mongoose')
const moment = require('moment')
const bodyParser = require('body-parser');
const { body, validationResult } = require('express-validator');
const Url = require('./models/urls')
const Sms = require('./models/sms')
var isUrl = require('is-url')
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}
const app = express()

const databaseUrl = process.env.DATABASE || 'mongodb://localhost:27017/smstemplate'

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

mongoose.connect(databaseUrl, {
  useNewUrlParser: true, useUnifiedTopology: true
})

app.set('view engine', 'ejs')
app.use(express.urlencoded({ extended: false }))

app.get('/', async (req, res) => {
  const sms = await Sms.find()
  res.render('index', { sms: sms, moment: moment })
})

app.get('/createSms', async (req, res) => {
  const sms = await Sms.find({}, { _id: 1, content: 1 })
  res.render('createSms', { sms: sms })
})


app.post('/createSms', async (req, res) => {
  let id = req.body.template
  let dynamicTexts = req.body.dynamicTexts
  let words = dynamicTexts.split(",")
  let smsDet = await Sms.findOne({ _id: mongoose.Types.ObjectId(id) }, { content: 1 })
  if (!smsDet) return res.status(400).send({
    message: 'Sms template not exist!'
  });
  else {
    var re = /\$.*?\$/ig
    var match;
    var i = 0;
    while ((match = re.exec(smsDet.content)) != null) {
      if (isUrl(words[i])) {
        let short = await shortUrl(words[i], id)
        words[i] = `<a href='${short}'>${short}</a>`
        console.log(words[i])
      }
      smsDet.content = smsDet.content.replace(match[0], (words[i]) ? words[i] : "")
      i++
    }
    res.send(smsDet.content + `<br/> <a href="/createSms">Back</a>`)
  }

})

app.post('/save', [
  body('content').isLength({ min: 5 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  let obj = {
    content: req.body.content
  }
  if (req.body.id) {
    await Sms.updateOne({ _id: mongoose.Types.ObjectId(req.body.id) }, obj)
  } else {
    await Sms.create(obj)
  }
  res.redirect('/')
})

app.get('/:code', async (req, res) => {
  let response = await Url.findOne({ code: req.params.code })
  if (!response) return res.sendStatus(404)
  res.redirect(response.url)

})
app.get('/delete/:id', async (req, res) => {
  if (!req.params.id) return res.status(400).send({
    message: 'Id not exist!'
  });
  let response = await Sms.findOneAndDelete({ "_id": req.params.id })
  if (!response) res.status(404).send({
    message: "Sms not found with id " + req.params.id
  });
  else
    res.redirect('/')
})




async function shortUrl(mainUrl, id) {
  let code = await generateRandomString(6)
  let obj = {
    url: mainUrl,
    code: code,
    shortUrl: baseUrl + '/' + code,
    templateId: mongoose.Types.ObjectId(id)
  }
  let res = await Url.findOne({ url: mainUrl })
  if (res)
    return res.shortUrl
  else {
    Url.create(obj)
    return obj.shortUrl
  }
}

async function generateRandomString(length) {
  let charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  let res = await Url.findOne({ where: { code: retVal } })
  if (res) {
    generateRandomString(length)
  } else {
    return retVal;
  }
}




app.listen(process.env.PORT || 3000, () => {
  console.log("Server listening")
});



