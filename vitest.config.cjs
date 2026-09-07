module.exports = {
	resolve: {
		alias: [
			// n8n-workflow 1.82.0 omits its ESM source entry from the npm package.
			// Test the published CommonJS entry that n8n loads.
			{ find: /^n8n-workflow$/, replacement: require.resolve('n8n-workflow') },
		],
	},
	test: { include: ['test/**/*.test.ts'] },
};
