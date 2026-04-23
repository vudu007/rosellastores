# Weather Orchestrator Command

## Description
Orchestrates a multi-step process to deliver weather information for Dubai in a visual format.

## Process Flow

### Step 1: Initial Request
Prompt the user to specify their preferred temperature unit—either Celsius or Fahrenheit.

### Step 2: Data Retrieval
Use the Task tool to invoke the weather agent to fetch current Dubai temperatures. The weather-agent processes this request and returns numeric values with units.

### Step 3: Visual Generation
Use the Skill tool to invoke the weather-svg-creator skill to transform temperature data into an SVG card graphic.

## Implementation Rules
- Use the Task tool specifically for agent invocations (not bash commands)
- Use the Skill tool for SVG creation process
- Include the user's temperature preference with the agent request
- Save SVG output to `orchestration-workflow/weather.svg`
- Save markdown summary to `orchestration-workflow/output.md`

## Deliverables
Upon completion, users receive:
1. Confirmation of chosen unit
2. The fetched temperature value
3. An SVG weather card
4. A markdown summary
