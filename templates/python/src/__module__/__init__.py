def main() -> None:
    print(greeting("world"))


def greeting(name: str) -> str:
    return f"Hello, {name}, from {{name}}."
