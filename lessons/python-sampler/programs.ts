export const IMPORTS = `import math
import random
`;

export const SCORE_SETUP = `${IMPORTS}
scores = {"robot": 3.0, "panda": 1.4, "volcano": 0.2}
`;

export const WEIGHT_FUNCTION = `${SCORE_SETUP}
def sample(temperature):
    weights = [
        math.exp(score / temperature)
        for score in scores.values()
    ]
`;

export const SAMPLER_FUNCTION = `${WEIGHT_FUNCTION}    random.seed(1)
    return random.choices(
        list(scores), weights=weights, k=12
    )
`;

export const COLD_PROGRAM = `${SAMPLER_FUNCTION}
temperature = 0.5
print(" ".join(sample(temperature)))
`;

export const HOT_PROGRAM = COLD_PROGRAM.replace("temperature = 0.5", "temperature = 2.5");

export const COLD_OUTPUT = "robot robot robot robot robot robot robot robot robot robot robot robot\n";
export const HOT_OUTPUT = "robot volcano panda robot robot robot panda panda robot robot volcano robot\n";
