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

			const [giphyResults, tenorResults] = await Promise.all([giphyPromise, tenorPromise]);

			console.log("Combined Results - Giphy and Tenor:", [...giphyResults, ...tenorResults]); // Log combined results

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
			console.error("Error in makeGifSearchRequest:", error);
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

		// Handling the URL generation
		const gifUrl = isGiphy
		? GIPHY_MXC_PREFIX + gif.id
		: TENOR_MXC_PREFIX + gif.id;

		// Handling GIF metadata (height, width, size, mimetype)
		let gifInfo = null;

		if (isGiphy) {
			// Giphy: Fetch dimensions and size from the `original` image object
			gifInfo = {
				"h": +gif.images.original.height,
				"w": +gif.images.original.width,
				"size": +gif.images.original.size,
				"mimetype": "image/webp", // Use webp if available
			};
		} else if (gif.media_formats) {
			// Tenor: Select the best available GIF format based on media_formats
			const preferredFormat = gif.media_formats.gif || gif.media_formats.mediumgif || gif.media_formats.tinygif;

			if (preferredFormat) {
				gifInfo = {
					"h": +preferredFormat.dims[1], // Height
					"w": +preferredFormat.dims[0], // Width
					"size": +preferredFormat.size,  // Size
					"mimetype": "image/webp",       // Tenor typically provides WebP formats
				};
			}
		}

		// If gifInfo is null, log an error and return early
		if (!gifInfo) {
			console.error("Invalid GIF format", gif); // Log invalid gif structure
			return;
		}

		// Send the sticker using the widgetAPI
		widgetAPI.sendSticker({
			"body": gif.title || gif.content_description || 'GIF', // Fallback to description or generic title
			"info": gifInfo,
			"msgtype": "m.image",
			"url": gifUrl,
			"id": gif.id,
			"filename": gif.id + ".webp", // Use WebP filename
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
			: gif.media_formats && gif.media_formats.gif && gif.media_formats.gif.url
			? gif.media_formats.gif.url // Prefer the regular gif format
			: gif.media_formats.nanogif && gif.media_formats.nanogif.url
			? gif.media_formats.nanogif.url // Fallback to nanogif if regular gif is unavailable
			: null;

			if (!gifUrl) {
				console.warn("Skipping GIF due to missing URL:", gif); // Log missing URLs
				return null;
			}



			console.log("Rendering GIF:", gif); // Log each GIF being rendered

			return html`
			<div class="sticker" key=${gif.id} onClick=${() => this.handleGifClick(gif)} data-gif-id=${gif.id}>
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
