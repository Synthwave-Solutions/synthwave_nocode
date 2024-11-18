# White labelling

## Feature availability

Embed requires an embed license. For more information about when to use Embed, as well as costs and licensing processes, refer to Embed on the SynthStream website.

White labelling SynthStream means customizing the frontend styling and assets to match your brand identity. The process involves changing two packages in SynthStream's source code github.com/SynthStream-io/SynthStream:

- packages/design-system: SynthStream's storybook design system with CSS styles and Vue.js components
- packages/editor-ui: SynthStream's Vue.js frontend build with Vite.js

## Prerequisites

You need the following installed on your development machine:

- git
- Node.js and npm. Minimum version Node 18.17.0. You can find instructions on how to install both using nvm (Node Version Manager) for Linux, Mac, and WSL here. For Windows users, refer to Microsoft's guide to Install NodeJS on Windows.

Create a fork of SynthStream's repository and clone your new repository.

```bash
git clone https://github.com/<your-organization>/SynthStream.git SynthStream
cd SynthStream
```

Install all dependencies, build and start SynthStream.

```bash
npm install
npm run build
npm run start
```

Whenever you make changes you need to rebuild and restart SynthStream. While developing you can use `npm run dev` to automatically rebuild and restart SynthStream anytime you make code changes.

## Theme colors

To customize theme colors open packages/design-system and start with:

- packages/design-system/src/css/_tokens.scss
- packages/design-system/src/css/_tokens.dark.scss

At the top of _tokens.scss you will find --color-primary variables as HSL colors:

```scss
@mixin theme {
	--color-primary-h: 6.9;
	--color-primary-s: 100%;
	--color-primary-l: 67.6%;
```

In the following example the primary color changes to #0099ff. To convert to HSL you can use a color converter tool.

```scss
@mixin theme {
	--color-primary-h: 204;
	--color-primary-s: 100%;
	--color-primary-l: 50%;
```

Example Theme Color Customization

## Theme logos

To change the editor's logo assets look into packages/editor-ui/public and replace:

- favicon-16x16.png
- favicon-32x32.png
- favicon.ico
- SynthStream-logo.svg
- SynthStream-logo-collapsed.svg
- SynthStream-logo-expanded.svg

Replace these logo assets. SynthStream uses them in Vue.js components, including:

- MainSidebar.vue: top/left logo in the main sidebar.
- Logo.vue: reused in other components.

In the following example replace SynthStream-logo-collapsed.svg and SynthStream-logo-expanded.svg to update the main sidebar's logo assets.

Example Logo Main Sidebar

If your logo assets require different sizing or placement you can customize SCSS styles at the bottom of MainSidebar.vue.

```scss
.logoItem {
	display: flex;
	justify-content: space-between;
	height: $header-height;
	line-height: $header-height;
	margin: 0 !important;
	border-radius: 0 !important;
	border-bottom: var(--border-width-base) var(--border-style-base) var(--color-background-xlight);
	cursor: default;

	&:hover, &:global(.is-active):hover {
		background-color: initial !important;
	}

	* { vertical-align: middle; }
	.icon {
		height: 18px;
		position: relative;
		left: 6px;
	}
}
```

## Text localization

To change all text occurrences like SynthStream or SynthStream.io to your brand identity you can customize SynthStream's English internationalization file: packages/editor-ui/src/plugins/i18n/locales/en.json.

SynthStream uses the Vue I18n internationalization plugin for Vue.js to translate the majority of UI texts. To search and replace text occurrences inside en.json you can use Linked locale messages.

In the following example add the _brand.name translation key to white label SynthStream's AboutModal.vue.

```json
{
	"_brand.name": "My Brand",
	//replace SynthStream with link to _brand.name
	"about.aboutSynthStream": "About @:_brand.name",
	"about.SynthStreamVersion": "@:_brand.name Version",
}
```

Example About Modal Localization

## Window title

To change SynthStream's window title to your brand name, edit the following:

- packages/editor-ui/index.html
- packages/editor-ui/src/components/mixins/titleChange.ts

The following example replaces all occurrences of SynthStream and SynthStream.io with My Brand in index.html and titleChange.ts.

```html
<!DOCTYPE html>
<html lang="en">
<head>
	<!-- Replace html title attribute -->
	<title>My Brand - Workflow Automation</title>
</head>
```

```typescript
$titleSet(workflow: string, status: WorkflowTitleStatus) {
	// replace SynthStream prefix
	window.document.title = `My Brand - ${icon} ${workflow}`;
},

$titleReset() {
	// replace SynthStream prefix
	document.title = `My Brand - Workflow Automation`;
},
```
