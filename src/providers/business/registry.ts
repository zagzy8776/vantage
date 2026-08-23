import { foursquareBusinessProvider } from "./foursquare";
import { yelpBusinessProvider } from "./yelp";
import type { BusinessDiscoveryProvider, DiscoverySource } from "./types";

export const providerRegistry: Record<DiscoverySource, BusinessDiscoveryProvider> = {
  foursquare: foursquareBusinessProvider,
  yelp: yelpBusinessProvider,
};
