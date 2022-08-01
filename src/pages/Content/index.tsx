const FLOATREGEX = /([-\.0-9])+/;
const EARTHRADIUS = 6378137;

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

/* Content Script:
 * (for now) only runs on "https://www.google.com/maps/search/Restaurants/*"
 *
 * Parses the user's restaurant results, location, and map bounds. Then fetches external review information
 * to augment page results.
 */

/* 1. Continually Determine Map Bounds from DOM
 * 2. Update Current Restaurant List from page elements
 * 3. Fetch Relevant/Missing Restaurant Review data
 * 4. Augment Page Results
 *
 */
let currentMapBounds: MapBounds;
let currentRestaurantList: [Restaurant?] = [];

chrome.runtime.onMessage.addListener(
	function (request, sender, sendResponse) {
		console.log(sender.tab ?
			"from a content script:" + sender.tab.url :
			"from the extension");
		if (request.farewell === "goodbye")
			sendResponse({ farewell: "goodbye" });
	}
);


setInterval(() => {
	buildMapBoundsFromCoordinates();
	refreshRestaurantList();
}, 3000);

function fetchReviewMeta(restaurant: Restaurant) {
	console.log("fetching restaurant review meta...")

	chrome.runtime.sendMessage({ function: "fetchReviewMeta", restaurant: restaurant }, function (response) {
		var lastError = chrome.runtime.lastError;
		if (lastError) {
			console.log(lastError.message);
			return;
		}
		console.log(response)
	});
}

function refreshRestaurantList() {
	console.log("parsing visible restaurant list...")
	var htmlResults = document!.querySelector('[aria-label="Results for Restaurants"]');
	var htmlRestaurantList: NodeListOf<Element> = htmlResults!.querySelectorAll('[role="article"]');
	var currentList = currentRestaurantList.map(r => r!.gMapsDisplayText)

	Array.from(htmlRestaurantList).forEach(r => {
		if (!currentList.includes(r.textContent)) {
			let restaurant: Restaurant = {
				name: r.ariaLabel || "",
				gMapsDisplayText: r.textContent || "",
				mapBounds: currentMapBounds,
				location: "",
				addressStreet: "string"
			}
			currentRestaurantList.push(restaurant)
			fetchReviewMeta(restaurant);
		}
	})
}

function getCoordinatesFromPath(path: string) {
	let pathParams = path.split('/');
	let pathMapBounds = pathParams[4].split(',');
	let [lat, lng, z] = pathMapBounds;

	const latitude = parseFloat(lat!.match(FLOATREGEX)![0]);
	const longitude = parseFloat(lng!.match(FLOATREGEX)![0]);
	const zoom = parseFloat(z!.match(FLOATREGEX)![0]);

	return { latitude, longitude, zoom }
}

function buildMapBoundsFromCoordinates() {
	console.log("rebuilding map bounds...")
	//1. Pull lat and lng from URL
	const url = new URL(document.location.href);
	const { latitude, longitude, zoom } = getCoordinatesFromPath(url.pathname)

	//2. Calculate map size in pixels (x, y)
	let box = document.querySelector("canvas")
	let viewWidth = box?.offsetWidth;
	let viewHeight = box?.offsetHeight;

	//3. Calculate meters/pixel based on Google Maps zoom level
	//Note: Google Maps zoom range is 0 - 21
	let metersPerPixel = Math.cos(latitude * Math.PI / 180) * 2 * Math.PI * EARTHRADIUS / (256 * Math.pow(2, zoom));

	//4. Draw box from map size in meters and save to mapBounds 
	let dy = ((viewHeight! / 2) * metersPerPixel)
	let dx = ((viewWidth! / 2) * metersPerPixel)

	currentMapBounds = {
		northLatitude: latitude + (dy / EARTHRADIUS) * (180 / Math.PI),
		eastLongitude: longitude + (dx / EARTHRADIUS) * (180 / Math.PI) / Math.cos(latitude * Math.PI / 180),
		southLatitude: latitude - (dy / EARTHRADIUS) * (180 / Math.PI),
		westLongitude: longitude - (dx / EARTHRADIUS) * (180 / Math.PI) / Math.cos(latitude * Math.PI / 180),
	}
}