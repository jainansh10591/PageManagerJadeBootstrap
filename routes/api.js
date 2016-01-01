var express = require('express');
var router = express.Router();
var Facebook = require('facebook-node-sdk');
var Step = require('step');
var url = require('url');
var querystring = require('querystring');
var fs = require('fs');

var requestedScope = ['manage_pages','publish_pages', 'ads_management', 'read_insights'];

router.get('/', function(req, res) {
  if (!req.facebook) {
      Facebook.middleware(config)(req, res, afterNew);
  }

  req.facebook.getUser(function(err, user) {
      if (err) {
        res.render('pages/error');
      }
      else {
        var data = {};
        if (user === 0) { 
          data.loggedIn = false;
        }
        else {
          data.loggedIn = true;
          
        }
        res.render('pages/index', data);
      }
  });
});

// Login
router.get('/login', Facebook.loginRequired({scope: requestedScope}), function(req, res) {
  res.redirect('/me/pages');
});

// Logout
router.get('/logout', Facebook.logout(), function(req, res) {
});

// Get all pages owned by loggedIn User
router.get('/me/pages', Facebook.loginRequired({scope: requestedScope}), function(req, res) {
  var data = {
      "pages": null,
      "prev": null,
      "next": null,
      "params": {

      }
    };

  var query = req._parsedUrl.query;
  var accounts_url = '/me/accounts';
  if(query!=null){
    accounts_url = accounts_url+'?'+query;
  }
  data.params.accounts_url = accounts_url;
  exports.getOwnedPages(req, res, data);  
});

exports.getOwnedPages = function(req, res, data){
  req.facebook.api(data.params.accounts_url, 'GET', function(err, result){
    if(err){
      res.render('pages/error');
      return;
    }
    data.pages = result;
    exports.checkPreviousPaginationPage(req, res, data);
  });
}
exports.checkPreviousPaginationPage = function(req, res, data){
  if(data.pages.paging!=null && data.pages.paging.previous!=null){
      req.facebook.api(data.pages.paging.previous,'GET' ,function(err, result){
        if(err){
          res.render('pages/error');
          return;
        }
        if(result!=null && result.data.length!=0){
          data.prev = data.params.accounts_url+ url.parse(data.pages.paging.previous).search;
        }
        exports.checkNextPaginationPage(req, res, data);
      });
  }
  else{
    exports.checkNextPaginationPage(req, res, data);
  }
}
exports.checkNextPaginationPage = function(req, res, data){
  if(data.pages.paging!=null && data.pages.paging.next!=null){
      req.facebook.api(data.pages.paging.next,'GET' ,function(err, result){
        if(err){
          res.render('pages/error');
          return;
        }
        if(result!=null && result.data.length!=0){
          data.next = data.params.accounts_url+ url.parse(data.pages.paging.next).search;
        }
        data.params = null;
        res.render('pages/pages', data);
      });
  }
  else{
    data.params = null;
    res.render('pages/pages', data);
  }
}


// Get all post of a page
router.get('/page/:id/posts/:type', Facebook.loginRequired({scope: requestedScope}), function(req, res) {
    exports.getPagePosts(req, res);
});

var postsSelection = {
  "all": "All Posts",
  "published": "Published Posts",
  "unpublished": "Unpublished Posts"
}; 

exports.getPagePosts = function(req, res){

    var data = exports.defaultData();
    data.posts_type = req.params.type;
    var category = postsSelection[req.params.type];

    data.page_post_heading = category;
    if(category == postsSelection.published){
      data.active_link.published = true;
    }
    else if(category == postsSelection.unpublished){
      data.active_link.unpublished = true;
    }
    else{
      data.active_link.all = true;
    }

    data.params.id= req.params.id;
    data.base_url = '/page/'+req.params.id;
    var query = req._parsedUrl.query;
    var feed_url = '/'+data.params.id+'/feed';
    if(query!=null){
      feed_url = feed_url+'?'+query;
    }
    data.params.feed_url = feed_url;

    data.params.page_info_url = '/'+req.params.id +'?fields=name,id,about,category,access_token';
    exports.getPageDetails(req, res, data);
};

exports.getPageDetails = function(req, res, data) {
    req.facebook.api(data.params.page_info_url,'GET', function(err, result){
      if(err){
        res.render('pages/error');
        return;
      }
      data.page_details = result;
      exports.getFeeds(req, res, data);
    });
};

exports.getFeeds = function(req, res, data) {
    req.facebook.api(data.params.feed_url,'GET', function(err, result){
      if(err){
        res.render('pages/error');
        return;
      }
      data.posts = result;
      exports.checkPreviousPagination(req, res, data);
    });
};
exports.checkPreviousPagination = function(req, res, data) {

    if(data.posts.paging!=null && data.posts.paging.previous!=null){
      req.facebook.api(data.posts.paging.previous,'GET' ,function(err, result){
        if(err){
          res.render('pages/error');
          return;
        }
        if(result!=null && result.data.length !=0){
            data.prev = '/page/'+data.params.id+ url.parse(data.posts.paging.previous).search;
        }
        exports.checkNextPagination(req, res, data);
      });
    }
    else{
      exports.checkNextPagination(req, res, data);
    }
};
exports.checkNextPagination = function(req, res, data) {
    if(data.posts.paging!=null && data.posts.paging.next!=null){
      req.facebook.api(data.posts.paging.next,'GET' ,function(err, result){
        if(err){
          res.render('pages/error');
          return;
        }
        if(result!=null && result.data.length !=0){
            data.next = '/page/'+data.params.id+ url.parse(data.posts.paging.next).search;
        }
        
        data.params = null;
        exports.getIds(data);

        exports.getReaches(req,res,data);
      });
    }
    else{
      data.params = null;
      exports.getReaches(req,res,data);
    }
};

exports.getReaches = function(req, res, data){
  if(data.reachs_id!=null){
    req.facebook.api('/insights/post_impressions_unique?ids='+data.reachs_id,'GET' ,function(err, result){
      if(err){
        res.render('pages/error');
        return;
      }
      else{
        data.reachs = result;
        res.render('pages/posts', data);
      }
    });
  }
  else{
    res.render('pages/posts', data);
  }
};

exports.getIds = function(data){
  if(data.posts==null)return;

  var ids ="";
  for(var i=0;i<data.posts.data.length;i++){
    ids = ids+data.posts.data[i].id;
    if(i < data.posts.data.length-1){
      ids=ids+",";
    }
  }
  data.reachs_id = ids;
};


exports.defaultData = function(){
  var data = {
      "page_details": null,
      "posts": null,
      "reachs": null,
      "reachs_id": null,
      "prev": null,
      "next": null,
      "active_link": {
        "all": null,
        "published": null,
        "unpublished": null
      },
      "posts_type": null,
      "page_post_heading": null,
      "base_url": null,
      "params": {
      }
    };
  return data;
};

router.get('/page/:id/view', Facebook.loginRequired({scope: requestedScope}), function(req, res) {
  req.facebook.api('/me', function(err, user) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello, ' + JSON.stringify(user) + '!');
  });
});

router.get('/page/:id/edit', Facebook.loginRequired({scope: requestedScope}), function(req, res) {
  req.facebook.api('/me', function(err, user) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello, ' + JSON.stringify(user) + '!');
  });
});

router.get('/page/:id/delete', Facebook.loginRequired({scope: requestedScope}), function(req, res) {
  req.facebook.api('/me', function(err, user) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello, ' + JSON.stringify(user) + '!');
  });
});

router.get('/page/:id/post', Facebook.loginRequired({scope: requestedScope}), function(req, res) {
  req.facebook.api('/me', function(err, user) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello, ' + JSON.stringify(user) + '!');
  });
});

router.get('/page/:id/unpublished_post', Facebook.loginRequired({scope: requestedScope}), function(req, res) {
  req.facebook.api('/me', function(err, user) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello, ' + JSON.stringify(user) + '!');
  });
});



// ********************** Post Calls
router.post('/page/:id/post/:type', Facebook.loginRequired({scope: requestedScope}), function(req, res) {

  req.facebook.api('/'+req.params.id +'?fields=name,id,about,category,access_token','GET', function(err, result){
    if(err){
      res.render('pages/error');
      return;
    }

    var data = {access_token: result.access_token};
    var api_url = '';
    var redirect_uri = "/page/"+req.params.id+'/posts/'+req.params.type;
    if(req.params.type == "unpublished"){
      data.published = 0;
    }

    switch (req.body.type) {
      case "status":
      case "link":
          if(req.body.message) data.message = req.body.message;
          if(req.body.link) data.link = req.body.link;
          if(req.body.name) data.name = req.body.name;
          if(req.body.description) data.description = req.body.description;
          if(req.body.caption) data.caption = req.body.caption;
          if(req.body.picture) data.picture = req.body.picture;
          // error here
          if(req.files && req.files.thumbnail) data.thumbnail = '@'+req.files.thumbnail.path;

          //check for call_to_action in published
          if(req.params.type == "unpublished"){
            if(req.body.callToAction) {
              data.call_to_action = {
                "type": req.body.callToActionSelect,
                "value": req.body.link
              };
            }
          }
          
          api_url = '/'+req.params.id+'/feed';
          break;
      case "photo":
          if(req.body.message) data.message = req.body.message;
          if(req.body.url) data.url = req.body.url;
          if(req.files.source) data.source = '@'+req.files.source.path;
          api_url = '/'+req.params.id+'/photos';
          break;  
      case "video":
          api_url = '/'+req.params.id+'/videos';
          if(req.files.source) data.source = '@'+req.files.source.path;
          break;
    }

    console.log("---data--");
    console.log(data);
    req.facebook.api(api_url,'POST', data ,function(err, result) {
      if(err){
        console.log("--error--");
        console.log(err);
        res.render('pages/error');
        return;
      }
      res.redirect(redirect_uri);
    });    
  });

});


module.exports = router;
