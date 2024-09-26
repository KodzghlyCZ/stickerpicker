import { Component, html } from "../lib/htm/preact.js";
import * as widgetAPI from "./widget-api.js";
import { SearchBox } from "./search-box.js";

const GIPHY_SEARCH_DEBOUNCE = 1000;
let GIPHY_API_KEY = "HQku8974Uq5MZn3MZns46kXn2R4GDm75";
let GIPHY_MXC_PREFIX = "mxc://giphy.mau.dev/";
let TENOR_API_KEY = "AIzaSyA2q2dmfESwk9qzOkP8Fz1_rK0qfFyyIv4"; // Your Tenor API key here
let TENOR_MXC_PREFIX = "mxc://tenor.mau.dev/";

export function giphyIsEnabled() {
	return GIPHY_API_KEY !== "";
}

export function setGiphyAPIKey(apiKey, mxcPrefix) {
	GIPHY_API_KEY = apiKey;
	if (mxcPrefix) {
		GIPHY_MXC_PREFIX = mxcPrefix;
	}
}

export function setTenorAPIKey(apiKey, mxcPrefix) {
	TENOR_API_KEY = apiKey;
	if (mxcPrefix) {
		TENOR_MXC_PREFIX = mxcPrefix;
	}
}

export class GiphySearchTab extends Component {
	constructor(props) {
		super(props);
		this.state = {
			searchTerm: "",
			gifs: [],
			loading: false,
			error: null,
		};
		this.handleGifClick = this.handleGifClick.bind(this);
		this.searchKeyUp = this.searchKeyUp.bind(this);
		this.updateGifSearchQuery = this.updateGifSearchQuery.bind(this);
		this.searchTimeout = null;
	}

	async makeGifSearchRequest() {
		try {
			this.setState({ loading: true });

			// Fetch GIFs from Giphy
			const giphyPromise = fetch(`https://api.giphy.com/v1/gifs/search?q=${this.state.searchTerm}&api_key=${GIPHY_API_KEY}`)
			.then(resp => resp.json())
			.then(data => {
				console.log("Giphy Results:", data.data); // Log Giphy results
				return data.data || [];
			})
			.catch(error => {
				console.error("Error fetching Giphy results:", error);
				return [];
			});

			// Fetch GIFs from Tenor
			const tenorPromise = fetch(`https://tenor.googleapis.com/v2/search?q=${this.state.searchTerm}&key=${TENOR_API_KEY}&limit=8`)
			.then(resp => resp.json())
			.then(data => {
				console.log("Tenor Results:", data.results); // Log Tenor results
				return data.results || [];
			})
			.catch(error => {
				console.error("Error fetching Tenor results:", error);
				return [];
			});

			// Wait for both requests to complete
			const [giphyResults, tenorResults] = await Promise.all([giphyPromise, tenorPromise]);

			console.log("Combined Results - Giphy and Tenor:", [...giphyResults, ...tenorResults]); // Log combined results

			// Combine results into one list
			const combinedResults = [
				...giphyResults.map(gif => ({ ...gif, source: "giphy" })),
				...tenorResults.map(gif => ({ ...gif, source: "tenor" }))
			];

			if (combinedResults.length === 0) {
				this.setState({ gifs: [], error: "No results" });
			} else {
				this.setState({ gifs: combinedResults, error: null });
			}

			this.setState({ loading: false });
		} catch (error) {
			this.setState({ error, loading: false });
			console.error("Error in makeGifSearchRequest:", error); // Log general errors
		}
	}

	componentWillUnmount() {
		clearTimeout(this.searchTimeout);
	}

	searchKeyUp(event) {
		if (event.key === "Enter") {
			clearTimeout(this.searchTimeout);
			this.makeGifSearchRequest();
		}
	}

	updateGifSearchQuery(event) {
		this.setState({ searchTerm: event.target.value });
		clearTimeout(this.searchTimeout);
		this.searchTimeout = setTimeout(() => this.makeGifSearchRequest(), GIPHY_SEARCH_DEBOUNCE);
	}

	handleGifClick(gif) {
		const isGiphy = gif.source === "giphy";
		const gifUrl = isGiphy
		? GIPHY_MXC_PREFIX + gif.id
		: TENOR_MXC_PREFIX + gif.id;

		const gifInfo = isGiphy
		? {
			"h": +gif.images.original.height,
			"w": +gif.images.original.width,
			"size": +gif.images.original.size,
			"mimetype": "image/webp",
		}
		: gif.media && gif.media[0] && gif.media[0].nanogif // Check if media exists and has a gif object
		? {
			"h": +gif.media[0].nanogif.dims[1],
			"w": +gif.media[0].nanogif.dims[0],
			"size": +gif.media[0].nanogif.size,
			"mimetype": "image/webp",
		}
		: null;

		if (!gifInfo) {
			console.error("Invalid GIF format", gif); // Log invalid gif structure
			return; // Skip sending if GIF info is missing
		}

		widgetAPI.sendSticker({
			"body": gif.title,
			"info": gifInfo,
			"msgtype": "m.image",
			"url": gifUrl,
			"id": gif.id,
			"filename": gif.id + ".webp",
		});
	}

	render() {
		return html`
		<${SearchBox} onInput=${this.updateGifSearchQuery} onKeyUp=${this.searchKeyUp} value=${this.state.searchTerm} placeholder="Find GIFs"/>
		<div class="pack-list">
		<section class="stickerpack" id="pack-giphy">
		<div class="error">
		${this.state.error}
		</div>
		<div class="sticker-list">
		${this.state.gifs.map((gif) => {
			const gifUrl = gif.source === "giphy"
			? gif.images.fixed_height.url
			: gif.media && gif.media[0] && gif.media[0].nanogif // Ensure media and gif are present
			? gif.media[0].nanogif.url
			: null;

			if (!gifUrl) {
				return null; // Skip rendering if gif URL is missing
			}

			return html`
			<div class="sticker" onClick=${() => this.handleGifClick(gif)} data-gif-id=${gif.id}>
			<img src=${gifUrl} alt=${gif.title} class="visible" />
			</div>
			`;
		})}
		</div>
		<div class="footer powered-by">
		<img src="./res/powered-by-giphy.png" alt="Powered by GIPHY"/>
		<img src="./res/powered-by-tenor.png" alt="Powered by Tenor"/>
		</div>
		</section>
		</div>
		`;
	}
}
