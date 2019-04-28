const express = require('express'); 
const app = express();
 
app.use(express.static('dist'));

//make way for some custom css, js and images
app.use('/css', express.static(__dirname + '/project/css'));
app.use('/ts', express.static(__dirname + '/project/ts'));
app.use('/images', express.static(__dirname + '/project/images'));

var server = app.listen(8081, function(){
    var port = server.address().port;
    console.log("Server started at http://localhost:%s", port);
});
