# Tweet Scraper

The actor crawls specified twitter profiles and scrapes the following information:

- Name
- Description
- Location
- Date joined
- List of tweets, retweets, and replies
- Number of favorites, replies, and retweets for each tweet
- Conversation threads the tweets belong to

The actor is useful for extracting large amounts of tweet data. Unlike the Twitter API, it does not have rate limit contraints. 

## Input Configuration

The actor has the following input options

- **Login Cookies** - Your Twitter login cookies (no username/password is submitted). For instructions on how to get your login cookies, please see our [tutorial](https://apify.com/help-dev/en/articles/1444249-log-in-to-website-by-transferring-cookies-from-web-browser).
- **List of Handles** - Specify a list of twitter handles (usernames) you want to scrape
  shall the crawler visit. If zero, the actor ignores the links and only crawls the Start URLs.
- **Max. Tweets** - Specify the maximum number of tweets you want to scrape.
- **Proxy Configuration** - Optionally, select a proxy to be used by the actor.

## Results

The actor stores its results into the default dataset associated with the actor run,
from where they can be downloaded in formats like JSON, HTML, CSV or Excel.

For each Twitter profile scraped, the resulting dataset contains a single record, which looks as follows (in JSON format):

```json
{
  "user": {
    "name": "Patrick Collison",
    "description": "Fallibilist, optimist. Stripe CEO.",
    "location": "patrick@stripe.com",
    "joined": "Tue Apr 17 01:46:27 +0000 2007",
    "username": "patrickc"
  },
  "tweets": [
    {
      "contentText": "@balajis I'm very happy to visit many restaurants that I suspect are not particularly good businesses.",
      "conversationId": "1162066623240347648",
      "replies": 2,
      "retweets": 0,
      "favorites": 51,
      "dateTime": "Thu Aug 15 18:23:53 +0000 2019",
      "tweetId": "1162067401954869248"
    },
    {
      "contentText": "I've wanted this feature for so long. 😍 https://t.co/jspRvv8wDD https://t.co/Q0gRwwIGYd https://t.co/k30UK0hvdc",
      "conversationId": "1161319133570457600",
      "replies": 13,
      "retweets": 12,
      "favorites": 247,
      "dateTime": "Tue Aug 13 16:50:32 +0000 2019",
      "tweetId": "1161319133570457600"
    },
    ... 
  ]
}
```

To download the results, you can use the [Get items](https://apify.com/docs/api/v2#/reference/datasets/item-collection/get-items) Apify API endpoint.

```
https://api.apify.com/v2/datasets/[DATASET_ID]/items?format=json
```

Where `DATASET_ID` is the ID of the dataset as provided in the actor run object. You can use the `format` query parameter to specify format of the results, e.g. `xml`, `csv` or `xlsx`.
