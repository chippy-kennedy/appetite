console.log('Background Loaded.');

interface MapBounds {
  northLatitude: number,
  eastLongitude: number,
  southLatitude: number,
  westLongitude: number
}

interface Restaurant {
  name: string;
  addressStreet?: string;
  location?: string;
  mapBounds: MapBounds;
  gMapsDisplayText: String | null; // Unique ID to tie Restaurant to page Element (via el.textContent)
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("message received");
  handleRequest(request, sender).then(sendResponse);
  return true; // return true to indicate you want to send a response asynchronously
});

async function handleRequest(request: any, sender: any) {
  console.log("handling request...");
  if (request.function === "fetchReviewMeta") {
    var infatuationMeta: any = await fetchInfatuationMeta(request.restaurant);
    var restaurantMeta = infatuationMeta.search!.results[0];

    if (!restaurantMeta || !closeEnough(request.restaurant, restaurantMeta)) {
      return { status: "restaurant not found" }
    }
    if (!restaurantMeta.rating) {
      return { status: "restaurant rating not found" }
    }

    return { status: "done", restaurant: { ...request.restaurant, ...restaurantMeta } };
  }
}

async function fetchInfatuationMeta(restaurant: Restaurant) {
  const bounds = urlifyMapBounds(restaurant.mapBounds);
  const query = urlifyQuery(restaurant.name);
  const location = "";

  const url = `https://tamland.zagat.com/v1/reviews?bounds=${bounds}&categoryIds=&cuisineIds=&cursor=&location=${location}&page=1&q=${query}&allowsReservations=&count=${1}&prices=&ratings=&open=`
  const options = {
    method: "GET",
  };
  const response = await fetch(url, options)
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      return data;
    });

  return response;
}

function urlifyMapBounds(bounds: MapBounds) {
  //"45.0158705%2C-71.777491%2C40.477399%2C-79.76258999999999"
  return bounds.northLatitude.toString() + "%2C" + bounds.eastLongitude.toString() + "%2C" + bounds.southLatitude.toString() + "%2C" + bounds.westLongitude.toString();
}

function urlifyQuery(q: string) {
  return q.replace(" ", "+").replace("&", "%26");
}

function closeEnough(res1: Restaurant, res2: Restaurant) {
  //"addressStreet":"30 W 24th St", "addressZipcode":"10010", "addressCity":"New York", "addressState":"NY",
  console.log("comparing...")
  console.log(res1)
  console.log(res2)

  return true;
}