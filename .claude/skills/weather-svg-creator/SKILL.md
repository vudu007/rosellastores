# Weather SVG Creator Skill

## Description
Generates a visual weather card for Dubai in SVG format.

## Input
- Temperature value with unit (Celsius or Fahrenheit)

## Output Files
1. SVG weather card: `orchestration-workflow/weather.svg`
2. Markdown summary: `orchestration-workflow/output.md`

## Key Requirements
- Use the exact temperature value and unit provided—do not re-fetch or modify
- Output files must be saved to the `orchestration-workflow/` directory
- The SVG must be self-contained and valid
- Ensure the SVG is properly formatted and displays correctly

## Process
1. Create the SVG using a template
2. Write the SVG file to `orchestration-workflow/weather.svg`
3. Write a markdown summary to `orchestration-workflow/output.md`

## Resources
See accompanying documentation:
- reference.md - Design specifications and templates
- examples.md - Usage examples and template pairs
